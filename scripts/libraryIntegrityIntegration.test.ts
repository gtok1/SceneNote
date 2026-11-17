import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url).href);
const projectRequire = createRequire(import.meta.url);
const esbuild = createRequire(projectRequire.resolve("tsx"))("esbuild") as {
  build(options: object): Promise<{ outputFiles: { text: string }[] }>;
};

const scenario = `
import assert from 'node:assert/strict';
import { getEpisodes, getEpisodeProgress, updateLibraryStatuses, updateLibraryManualProgress, updateLibraryWatchDates } from './src/services/library';
(async () => {
let state;
let network = 0;
globalThis.fetch = () => { network++; throw new Error('No network in library integrity regression'); };
const episode = n => ({ id: 'ep-' + n, content_id: 'work', season_id: 'season', episode_number: n, title: null, air_date: null, duration_seconds: null });
const reset = patch => state = { calls: [], rows: [], progress: [], count: 12, synced: null, mask: null, written: [], failStatusColumn: false, failPage: null, repeat: false, edge: 0, ...patch };
globalThis.__libraryIntegrityDb = {
  from(table) {
    const q = { table, action: 'read', columns: '', bounds: null };
    const builder = new Proxy({}, { get(_, method) {
      if (method === 'then') return (resolve, reject) => Promise.resolve().then(() => {
        state.calls.push({ ...q });
        if (q.action === 'write') {
          if (state.failStatusColumn) { state.failStatusColumn = false; return { data: null, error: { message: 'status_flags column missing' } }; }
          return { data: state.written, error: null };
        }
        if (table === 'seasons') return { data: { episode_count: state.count, episodes_synced_at: state.synced, published_episode_numbers: state.mask }, error: null };
        if (q.bounds && state.failPage === q.bounds[0]) return { data: null, error: { message: 'page failed' } };
        const rows = table === 'episodes' ? state.rows : state.progress;
        const from = state.repeat ? 0 : q.bounds?.[0] ?? 0;
        const to = state.repeat ? 999 : q.bounds?.[1] ?? 999;
        return { data: rows.slice(from, to + 1), error: null };
      }).then(resolve, reject);
      return (...args) => {
        if (method === 'update') q.action = 'write';
        if (method === 'select') q.columns = args[0];
        if (method === 'range') q.bounds = args;
        return builder;
      };
    }});
    return builder;
  },
  functions: { async invoke(name, options) {
    state.edge++;
    assert.equal(name, 'fetch-episodes');
    assert.equal(options.body.force_refresh, true);
    return { data: { episodes: state.fresh ?? Array.from({ length: state.count ?? 8 }, (_, n) => episode(n + 1)) }, error: null };
  }},
  auth: { async getSession() { return { data: { session: { user: { id: 'fixture-user' } } }, error: null }; } }
};

const writes = [
  () => updateLibraryStatuses('item', ['completed']),
  () => updateLibraryManualProgress('item', { seasonNumber: 1, episodeNumber: 7 }),
  () => updateLibraryWatchDates('item', { firstWatchedAt: '2026-01-01', lastWatchedAt: null })
];
for (const save of writes) {
  reset({}); await assert.rejects(save(), /저장하지 못했어요/);
  assert.equal(state.calls.at(-1).columns, 'id');
  reset({ written: [{ id: 'item' }] }); await save();
}
reset({ failStatusColumn: true }); await assert.rejects(writes[0](), /저장하지 못했어요/);
assert.equal(state.calls.length, 2);
reset({ rows: Array.from({ length: 1500 }, (_, n) => episode(n + 1)), count: 1500 });
assert.equal((await getEpisodes('work', 'season')).length, 1500);
assert.deepEqual(state.calls.filter(q => q.table === 'episodes').map(q => q.bounds), [[0,999],[1000,1999]]);
assert.equal(state.edge, 0);
reset({ rows: [episode(1)] });
assert.deepEqual((await getEpisodes('work', 'season')).map(row => row.episode_number), Array.from({ length: 12 }, (_, n) => n + 1));
assert.equal(state.edge, 1);
reset({ rows: Array.from({ length: 12 }, (_, n) => episode(n + 1)), count: null, synced: new Date().toISOString(), mask: [1,2,3,4,5,6,7,8] });
assert.deepEqual((await getEpisodes('work', 'season')).map(row => row.episode_number), [1,2,3,4,5,6,7,8]);
assert.equal(state.edge, 0);
reset({ rows: [episode(1)], count: null, synced: '2000-01-01T00:00:00Z', mask: [1], fresh: Array.from({ length: 8 }, (_, n) => episode(n + 1)) });
assert.equal((await getEpisodes('work', 'season')).length, 8); assert.equal(state.edge, 1);
reset({ rows: [episode(1)], fresh: [episode(1)] });
await assert.rejects(getEpisodes('work', 'season'), /모두 불러오지 못했어요/);
reset({ progress: Array.from({ length: 1500 }, (_, n) => ({ id: 'p-' + n, content_id: 'work', episode_id: 'ep-' + n })) });
assert.equal((await getEpisodeProgress('work')).length, 1500);
assert.deepEqual(state.calls.map(q => q.bounds), [[0,999],[1000,1999]]);
reset({ rows: Array.from({ length: 1000 }, (_, n) => episode(n + 1)), count: 1500, failPage: 1000 });
await assert.rejects(getEpisodes('work', 'season'), /page failed/);
reset({ progress: Array.from({ length: 1000 }, (_, n) => ({ id: 'p-' + n })), failPage: 1000 });
await assert.rejects(getEpisodeProgress('work'), /page failed/);
reset({ progress: Array.from({ length: 1000 }, (_, n) => ({ id: 'p-' + n })), repeat: true });
await assert.rejects(getEpisodeProgress('work'), /기록이 너무 많아/);
assert.equal(state.calls.length, 50);
assert.equal(network, 0);
console.log('library-integrity-service: ok');
})().catch(error => { console.error(error); process.exitCode = 1; });
`;

it("I-SVC1: actual library writes and episode reads reject silent partial success", async () => {
  const built = await esbuild.build({
    stdin: { contents: scenario, resolveDir: root, sourcefile: "library-integrity-fixture.ts" },
    bundle: true, platform: "node", format: "cjs", write: false,
    plugins: [{ name: "library-runtime-boundary", setup(build: {
      onResolve(options: object, callback: (args: { path: string }) => unknown): void;
      onLoad(options: object, callback: () => object): void;
    }) {
      build.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({ path: "db", namespace: "synthetic" }));
      build.onLoad({ filter: /.*/, namespace: "synthetic" }, () => ({ contents: "export const supabase = new Proxy({}, {get: (_, key) => globalThis.__libraryIntegrityDb[key]});", loader: "js", resolveDir: root }));
    }}]
  });
  const dir = mkdtempSync(join(tmpdir(), "scenenote-library-integrity-"));
  try {
    const path = join(dir, "scenario.cjs");
    const outputFile = built.outputFiles[0];
    assert.ok(outputFile);
    writeFileSync(path, outputFile.text);
    const output = execFileSync(process.execPath, [path], { cwd: root, encoding: "utf8", timeout: 20_000 });
    assert.match(output, /library-integrity-service: ok/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
