# 0004: Local S3-compatible object storage — SeaweedFS, not MinIO

## Context

CONTEXT.md section 12.3 named "Cloudflare R2 via S3 API (MinIO locally)" as the object storage
choice — MinIO was the obvious, previously-free local stand-in for R2's S3 API.

While standing up `docker-compose.yml` for M0, `docker pull minio/minio` and
`docker pull quay.io/minio/minio` (both the Docker Hub and MinIO's own quay.io mirror, tried with
`latest` and with a pinned historical release tag) both failed with an authorization error —
verified directly against this repo's Docker/Colima setup, not assumed from memory. MinIO has
moved its container images behind a login/subscription requirement; this is a real, current
ecosystem change (confirmed via multiple independent open-source projects hitting the same break
in September 2026), not something to route around with `docker login` in a repo meant to
`git clone && pnpm i && docker compose up -d` with no accounts required.

## Decision

Use **SeaweedFS** (`chrislusf/seaweedfs`, still freely pullable, Apache-2.0) as the local
S3-compatible object store, run via `weed server -s3` with a static identity config
(`scripts/seaweedfs-s3.json`) instead of MinIO's root-user model. `-s3.autoCreateBucket` (on by
default for admin identities) means no separate bucket-bootstrap init container is needed — the
prior `minio-init` service and `scripts/minio-init.sh` are removed outright rather than kept as
dead weight.

This only changes local development. `packages/reader`'s `ObjectStore` interface
(CONTEXT.md section 10, built starting M5) still targets the S3 API; Cloudflare R2 in
production is unaffected, since R2 was never MinIO or SeaweedFS-shaped — it's just "any S3 API
endpoint," which SeaweedFS's S3 gateway satisfies the same as MinIO would have.

## Alternatives considered

- **`docker login` to pull MinIO anyway**: rejected — adds a required account/credential step to
  every fresh clone, which the whole point of `docker-compose.yml` is to avoid.
- **Garage** (Deuxfleurs, AGPL-3.0, `dxflrs/garage`): also freely pullable and purpose-built as a
  minimal S3 store, but bootstrapping a single-node cluster needs a dynamically-generated node ID
  (`garage status` after first boot) before `garage layout assign`/`apply` can run — not something
  that reduces cleanly to a static config file the way SeaweedFS's `-s3.config` does. Revisit if
  SeaweedFS itself becomes hard to pull; Garage is the fallback.
- **LocalStack**: broader AWS emulation than needed here (this repo only ever needs S3), heavier
  image, rejected as overkill for a single-bucket object store.

## Consequences

- `scripts/seaweedfs-s3.json` holds a static local-only access key/secret pair
  (`pi_dev_access_key` / `pi_dev_secret_key_change_me`) — fine for local dev, never used in any
  deployed environment (R2 credentials there are real secrets from env, never committed).
- If MinIO's images become freely pullable again, this ADR is the record of why the switch
  happened — revisiting isn't required unless SeaweedFS itself becomes a problem.
- Every developer's fresh `docker compose up -d` now depends on `chrislusf/seaweedfs:latest`
  staying publicly pullable; if that ever breaks the same way MinIO's did, Garage (with a proper
  bootstrap script written at that point) is the next fallback per the alternatives above.
