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
// esbuild belongs to the existing tsx dependency; do not rely on npm hoisting it to the root.
const tsxRequire = createRequire(projectRequire.resolve("tsx"));
const esbuild = tsxRequire("esbuild") as {
  build(options: object): Promise<{ outputFiles: { text: string }[] }>;
};
interface StubPluginBuild {
  onResolve(options: { filter: RegExp }, handler: (args: { path: string }) => { path: string; namespace: string }): void;
  onLoad(options: { filter: RegExp; namespace: string }, handler: (args: { path: string }) => { contents: string; loader: string; resolveDir: string }): void;
}

const stubs: Record<string, string> = {
  "@/lib/supabase": "export const supabase = { from: table => globalThis.__fakeQuery(table) };",
  "@/stores/authStore": "export const useAuthStore = selector => selector({ user: { id: 'synthetic-user' } });",
  react: "export const useMemo = fn => fn();",
  "@tanstack/react-query": `
    export { QueryClient } from '@tanstack/query-core';
    export const useQueryClient = () => globalThis.__queryClient;
    export const useMutation = options => options;
    export const useQuery = options => options;
  `
};

// Bundle the actual service and mutation callbacks, replacing only runtime boundaries.
// Running in a child process keeps the network guard and mock globals out of other tests.
const scenario = `
import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/query-core';
import { getLibraryItems } from './src/services/library';
import { useUpdateLibraryManualProgress, useUpdateLibraryStatuses } from './src/hooks/useLibrary';
import { queryKeys } from './src/lib/query';

let networkCalls = 0;
globalThis.fetch = () => {
  networkCalls += 1;
  throw new Error('Network is forbidden in the synthetic library integration');
};
const seasons = [1, 2].map(number => ({
  id: 's' + number, content_id: 'work', season_number: number,
  episode_count: 10, title: null, air_year: 2020 + number
}));
const records = [1, 2, null].map(number => ({
  id: number === null ? 'whole' : 'item' + number,
  user_id: 'synthetic-user', content_id: 'work', status: 'watching', status_flags: ['watching'],
  season_number: number, manual_watched_season_number: null, manual_watched_episode_number: null,
  manual_progress_updated_at: null, added_at: '2020-01-01', updated_at: '2020-01-01',
  contents: {
    title_primary: 'Synthetic fixture', content_type: 'jdrama', source_api: 'tmdb',
    source_id: 'synthetic', content_genres: []
  }
}));
const progress = seasons.flatMap((season, index) =>
  Array.from({ length: index === 0 ? 10 : 3 }, (_, episode) => ({
    content_id: 'work', episode_id: season.id + '-' + (episode + 1),
    episodes: { season_id: season.id, episode_number: episode + 1 }
  }))
);
const tables = { user_library_items: records, seasons, user_episode_progress: progress, reviews: [], episodes: [] };
let syntheticWrites = 0;
globalThis.__fakeQuery = table => {
  assert.ok(Object.hasOwn(tables, table), 'unexpected table: ' + table);
  let patch = null;
  const filters = [];
  let start = 0;
  let end = Infinity;
  const query = new Proxy({}, {
    get: (_, method) => {
      if (method === 'then') return (resolve, reject) => Promise.resolve().then(() => {
        const selected = tables[table].filter(row => filters.every(([key, value]) => row[key] === value));
        if (patch) {
          syntheticWrites += 1;
          selected.forEach(row => Object.assign(row, patch));
        }
        return { data: selected.slice(start, end + 1), error: null };
      }).then(resolve, reject);
      assert.ok(['select', 'order', 'in', 'not', 'contains', 'eq', 'range', 'update'].includes(method), 'unexpected query method: ' + String(method));
      return (...args) => {
        if (method === 'update') patch = args[0];
        if (method === 'eq') filters.push(args);
        if (method === 'range') [start, end] = args;
        return query;
      };
    }
  });
  return query;
};

const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
globalThis.__queryClient = client;
try {
  const key = queryKeys.library.byStatus('synthetic-user', 'all');
  const watchingKey = queryKeys.library.byStatus('synthetic-user', 'watching');
  const shape = item => [item.effective_watched_through, item.episode_count, item.next_episode_number, item.manual_watched_absolute_number];
  const initial = await getLibraryItems('all');
  assert.deepEqual(initial.map(shape), [[10, 10, null, null], [3, 10, 4, null], [13, 20, 14, null]], 'initial service scope');
  client.setQueryData(key, initial);
  client.setQueryData(watchingKey, initial);
  const otherRegistrations = structuredClone([records[0], records[2]]);

  const manual = useUpdateLibraryManualProgress();
  const variables = { libraryItemId: 'item2', progress: { seasonNumber: 2, episodeNumber: 4 } };
  await manual.onMutate(variables);
  assert.deepEqual(shape(client.getQueryData(key)[1]), [4, 10, 5, 14], 'all-items optimistic cache');
  assert.deepEqual(shape(client.getQueryData(watchingKey)[1]), [4, 10, 5, 14], 'watching optimistic cache');
  await manual.mutationFn(variables);
  assert.deepEqual(shape((await getLibraryItems('all'))[1]), shape(client.getQueryData(key)[1]), 'manual save then reload');

  const status = useUpdateLibraryStatuses();
  for (const statuses of [['completed'], ['watching']]) {
    const args = { libraryItemId: 'item2', statuses };
    await status.onMutate(args);
    await status.mutationFn(args);
    assert.deepEqual(shape((await getLibraryItems('all'))[1]), shape(client.getQueryData(key)[1]), 'status save then reload: ' + statuses[0]);
  }
  assert.deepEqual(shape(client.getQueryData(key)[1]), [4, 10, 5, 14], 'completed removal restores manual position');
  assert.equal(records[1].manual_watched_episode_number, 4, 'completion preserves the saved position');

  const failedVariables = { libraryItemId: 'item2', progress: { seasonNumber: 2, episodeNumber: 8 } };
  const snapshot = await manual.onMutate(failedVariables);
  manual.onError(new Error('synthetic failure'), failedVariables, snapshot);
  assert.deepEqual(shape(client.getQueryData(key)[1]), [4, 10, 5, 14], 'failed save rolls back cache');

  const reset = { libraryItemId: 'item2', progress: null };
  await manual.onMutate(reset);
  await manual.mutationFn(reset);
  assert.deepEqual(shape(client.getQueryData(key)[1]), [3, 10, 4, null], 'reset returns to checked season progress');
  assert.deepEqual(shape((await getLibraryItems('all'))[1]), shape(client.getQueryData(key)[1]), 'reset then reload');
  assert.deepEqual([records[0], records[2]], otherRegistrations, 'other registrations remain unchanged');
  assert.equal(syntheticWrites, 4);
  assert.equal(networkCalls, 0);
  console.log(JSON.stringify({
    checks: ['initial service mapping', 'two query caches', 'save and reload', 'completed then watching', 'rollback', 'reset and reload', 'other registration preservation'],
    networkCalls, syntheticWrites
  }));
} finally {
  client.clear();
}
`;

it("keeps actual library service and mutation-cache wiring consistent through the season progress lifecycle", async () => {
  const directory = mkdtempSync(join(tmpdir(), "scenenote-library-progress-"));
  try {
    const result = await esbuild.build({
      absWorkingDir: root,
      stdin: { resolveDir: root, loader: "ts", contents: scenario },
      bundle: true,
      platform: "node",
      format: "esm",
      write: false,
      plugins: [{
        name: "synthetic-library-boundaries",
        setup(build: StubPluginBuild) {
          build.onResolve({ filter: /^(?:@\/lib\/supabase|@\/stores\/authStore|react|@tanstack\/react-query)$/ }, args => ({
            path: args.path, namespace: "synthetic"
          }));
          build.onLoad({ filter: /.*/, namespace: "synthetic" }, args => ({
            contents: stubs[args.path] ?? "", loader: "ts", resolveDir: root
          }));
        }
      }]
    });
    const source = result.outputFiles[0]?.text;
    assert.ok(source, "expected an in-memory integration bundle");
    const bundle = join(directory, "scenario.mjs");
    writeFileSync(bundle, source);
    const output = execFileSync(process.execPath, [bundle], { encoding: "utf8", timeout: 15_000 });
    const evidence = JSON.parse(output) as { checks: string[]; networkCalls: number; syntheticWrites: number };
    assert.equal(evidence.checks.length, 7);
    assert.equal(evidence.networkCalls, 0);
    assert.equal(evidence.syntheticWrites, 4);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
