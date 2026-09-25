import nodeCrypto from "node:crypto";

/**
 * UUIDv7 generation — see docs/CONTEXT.md section 18 decision 6 ("UUIDv7 IDs generated in the
 * app") and decision 9. Node's `randomUUIDv7()` (RFC 9562-compliant, millisecond timestamp +
 * secure random) is native as of the Node 24 LTS this repo targets — no npm dependency needed.
 * If a future deploy target drops below that, swap this one function for the `uuidv7` package;
 * every caller goes through `generateId()`, never Node's crypto module directly, so that swap
 * stays a one-line change.
 *
 * Imported from `node:crypto` explicitly, NOT the implicit `globalThis.crypto` — Vitest's test
 * environment substitutes a Web Crypto-subset `crypto` global that doesn't have this method yet,
 * verified directly while wiring this package's own tests. The `node:crypto` module import
 * doesn't go through that substitution.
 */

// @types/node hasn't caught up with this Node 24 runtime addition yet — the function exists
// (verified directly against the Node 24.21.0 binary this repo targets), the type doesn't.
interface CryptoModuleWithUUIDv7 {
  randomUUIDv7(): string;
}

export function generateId(): string {
  return (nodeCrypto as unknown as CryptoModuleWithUUIDv7).randomUUIDv7();
}
