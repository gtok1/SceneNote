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

it("I-A1 persisted credentials never override SDK events or finish SDK initialization", async () => {
  const directory = mkdtempSync(join(tmpdir(), "scenenote-auth-regression-"));
  try {
    const modulePath = join(directory, "auth.mjs");
    const result = await esbuild.build({
      stdin: {
        contents: "export { useAuthStore } from './src/stores/authStore'; export { createAuthSessionSync } from './src/utils/authSessionSync';",
        resolveDir: root, sourcefile: "auth-regression.ts", loader: "ts"
      },
      bundle: true, write: false, platform: "node", format: "esm", tsconfig: join(root, "tsconfig.json"),
      plugins: [{ name: "native-boundaries", setup(build: {
        onResolve(options: { filter: RegExp }, handler: (args: { path: string }) => { path: string; namespace: string }): void;
        onLoad(options: { filter: RegExp; namespace: string }, handler: (args: { path: string }) => { contents: string; loader: string }): void;
      }) {
        build.onResolve({ filter: /^@react-native-async-storage\/async-storage$|^react-native$/ }, args => ({ path: args.path, namespace: "fixture" }));
        build.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({
          contents: args.path === "react-native" ? "export const Platform={OS:'ios'};" : "export default globalThis.__storage;", loader: "js"
        }));
      } }]
    });
    writeFileSync(modulePath, result.outputFiles[0]!.text);
    const harness = `
import assert from 'node:assert/strict';
let resolveHydration;
let pendingHydration = new Promise(resolve => resolveHydration = resolve);
const writes=[];
globalThis.fetch=()=>{throw Error('network forbidden');};
globalThis.__storage={getItem:()=>pendingHydration,setItem:async(_key,value)=>writes.push(value),removeItem:async()=>{}};
const {useAuthStore,createAuthSessionSync}=await import(${JSON.stringify(modulePath)});
const oldSession={user:{id:'old-account'},access_token:'old-private-token'};
const newSession={user:{id:'new-account'},access_token:'new-private-token'};
let cacheClears=0;
const sync=createAuthSessionSync({getCurrentUserId:()=>useAuthStore.getState().user?.id??null,setSession:session=>useAuthStore.getState().setSession(session),clearUserCache:()=>cacheClears++});
sync.onAuthStateChange(newSession);
const finished=new Promise(resolve=>useAuthStore.persist.onFinishHydration(resolve));
resolveHydration(JSON.stringify({state:{session:oldSession,user:oldSession.user},version:0}));
await finished;
assert.equal(useAuthStore.getState().user.id,'new-account','delayed storage must not replace the latest SDK account');
assert.equal(cacheClears,1,'storage hydration does not bypass a second account switch');
assert.equal(writes.every(value=>!value.includes('private-token')),true,'Zustand must not persist duplicate credentials');

useAuthStore.getState().setSession(null);
useAuthStore.getState().setLoading(true);
pendingHydration=new Promise(resolve=>resolveHydration=resolve);
const pending=useAuthStore.persist.rehydrate();
resolveHydration(JSON.stringify({state:{session:oldSession,user:oldSession.user},version:0}));
await pending;
assert.equal(useAuthStore.getState().user,null,'persisted sessions are never an authentication source');
assert.equal(useAuthStore.getState().isLoading,true,'storage hydration must not finish SDK initialization');

pendingHydration=new Promise(resolve=>resolveHydration=resolve);
const signingOut=useAuthStore.persist.rehydrate();
sync.onAuthStateChange(null);
resolveHydration(JSON.stringify({state:{session:oldSession,user:oldSession.user},version:0}));
await signingOut;
assert.equal(useAuthStore.getState().session,null,'late storage cannot undo logout');
assert.equal(useAuthStore.getState().isLoading,false);
console.log('auth hydration regression passed');
`;
    const harnessPath = join(directory, "run.mjs");
    writeFileSync(harnessPath, harness);
    const output = execFileSync(process.execPath, [harnessPath], { encoding: "utf8", cwd: root });
    assert.match(output, /auth hydration regression passed/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
