import assert from "node:assert/strict";
import { it } from "node:test";

it("LS-U1 native sharing requires a configured public HTTPS origin", async () => {
  const { resolveLibraryShareOrigin } = await import("./libraryShareUrl");
  assert.throws(() => resolveLibraryShareOrigin({ platform: "ios" }), /공유 웹 주소/);
  assert.throws(() => resolveLibraryShareOrigin({ platform: "android", configuredOrigin: "http://example.com" }), /공유 웹 주소/);
});

it("LS-U2 native sharing rejects local or private origin addresses", async () => {
  const { resolveLibraryShareOrigin } = await import("./libraryShareUrl");
  for (const origin of ["https://localhost", "https://127.0.0.1", "https://10.0.0.1", "https://192.168.0.1", "https://172.20.1.1", "https://[::1]", "https://host.local"]) {
    assert.throws(() => resolveLibraryShareOrigin({ platform: "ios", configuredOrigin: origin }), /공유 웹 주소/);
  }
});

it("LS-U3 a configured public origin is normalized without adding a guessed domain", async () => {
  const { resolveLibraryShareOrigin } = await import("./libraryShareUrl");
  assert.equal(resolveLibraryShareOrigin({ platform: "ios", configuredOrigin: " https://share.example.com/ " }), "https://share.example.com");
});

it("LS-U4 origin configuration cannot contain credentials, paths, queries, or fragments", async () => {
  const { resolveLibraryShareOrigin } = await import("./libraryShareUrl");
  for (const configuredOrigin of ["https://user:pass@example.com", "https://example.com/path", "https://example.com?x=1", "https://example.com/#frag"]) {
    assert.throws(() => resolveLibraryShareOrigin({ platform: "android", configuredOrigin }), /공유 웹 주소/);
  }
});

it("LS-U5 web defaults to the currently loaded origin including the local development origin", async () => {
  const { resolveLibraryShareOrigin } = await import("./libraryShareUrl");
  assert.equal(resolveLibraryShareOrigin({ platform: "web", webOrigin: "http://localhost:8081" }), "http://localhost:8081");
});

it("LS-U6 explicit public configuration is preferred to the current web development origin", async () => {
  const { resolveLibraryShareOrigin } = await import("./libraryShareUrl");
  assert.equal(resolveLibraryShareOrigin({ platform: "web", configuredOrigin: "https://share.example.com", webOrigin: "http://localhost:8081" }), "https://share.example.com");
});

it("LS-U7 SSR without a configured origin never returns a relative share URL", async () => {
  const { resolveLibraryShareOrigin } = await import("./libraryShareUrl");
  assert.throws(() => resolveLibraryShareOrigin({ platform: "web" }), /공유 웹 주소/);
});
