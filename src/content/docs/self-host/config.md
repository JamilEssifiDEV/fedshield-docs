---
title: Configuration reference
description: Every environment variable the Federation Core reads, what it does, and what the default means.
---

The Federation Core reads all runtime configuration from environment variables. The reference below is the source-of-truth set from [`core/config/config.go`](https://github.com/JamilEssifiDEV/federation-core/blob/main/core/config/config.go) and the shipping `.env.example`.

## Server

| Variable | Default | Notes |
| --- | --- | --- |
| `SERVER_PORT` | `8080` | HTTP listen port. |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error`. |

## Database (PostgreSQL)

| Variable | Default | Notes |
| --- | --- | --- |
| `DB_HOST` | `localhost` | |
| `DB_PORT` | `5432` | Note: docker-compose maps Postgres to **host** port 5433. When running the Federation Core on the host (not in Docker), set `DB_PORT=5433`. |
| `DB_USER` | `fedshield` | |
| `DB_PASSWORD` | `fedshield_dev` | **Change before production.** |
| `DB_NAME` | `fedshield` | |

## Cache (Redis)

| Variable | Default | Notes |
| --- | --- | --- |
| `REDIS_HOST` | `localhost` | |
| `REDIS_PORT` | `6379` | |

## Auth

| Variable | Default | Notes |
| --- | --- | --- |
| `PEER_AUTH_ENABLED` | `false` | **Set to `true` before production.** Default is for local development convenience; with auth disabled, any caller can impersonate any peer. |

## Scoring engine — general

| Variable | Default | Notes |
| --- | --- | --- |
| `SCHEMA_VALIDATION_STRICT` | `true` | Reject events that fail JSON Schema validation. Keep `true` in production. |
| `TIME_DECAY_HALF_LIFE_DAYS` | `30` | Event weight is halved every N days. |

## Scoring engine — peer-weighting (EigenTrust)

| Variable | Default | Notes |
| --- | --- | --- |
| `ENGINE_EIGENTRUST_ALPHA` | `0.15` | Teleport probability. 0.15 matches the EigenTrust paper and PageRank's damping factor. |
| `ENGINE_EIGENTRUST_MAX_ITER` | `50` | Iteration cap (protects the score-query latency budget). |
| `ENGINE_EIGENTRUST_EPSILON` | `1e-6` | Convergence threshold on max element delta between iterations. |
| `ENGINE_LOW_TRUST_CUTOFF` | `0.2` | Peers below this `P_t` are excluded from the aggregate. **Calibration note**: a three-peer collusion scenario (one honest, two adversaries) needs this lowered to `0.05` so the honest peer's voice isn't zeroed; see RESULTS.md. |

## Scoring engine — pre-trust seeds (gate G5)

Opt-in. With `ENGINE_PRE_TRUST_ENABLED=false` (default) the engine behaviour is bit-identical to the pre-G5 implementation. Pre-trusted peers have their `P_t` floored at `ENGINE_PRE_TRUST_FLOOR` and are exempt from the low-trust cutoff.

| Variable | Default | Notes |
| --- | --- | --- |
| `ENGINE_PRE_TRUST_ENABLED` | `false` | |
| `ENGINE_PRE_TRUST_PEERS` | _empty_ | Comma-separated peer IDs, e.g. `peer-a-uuid,peer-d-uuid`. |
| `ENGINE_PRE_TRUST_FLOOR` | `0.05` | Minimum `P_t` for pre-trusted peers. |

## Scoring engine — coordination detector (gate G5)

Opt-in. With `ENGINE_COORDINATION_ENABLED=false` (default) the cluster detector returns nil and `ApplyClusterCap` is a no-op.

| Variable | Default | Notes |
| --- | --- | --- |
| `ENGINE_COORDINATION_ENABLED` | `false` | |
| `ENGINE_COORDINATION_MIN_EVENTS` | `10` | Per-peer minimum event count before the detector evaluates them. Below this, sampling variance dominates JSD. |
| `ENGINE_COORDINATION_SEVERITY_JSD` | `0.15` | Max JSD on severity distributions to cluster. |
| `ENGINE_COORDINATION_INTER_ARRIVAL_JSD` | `0.20` | Max JSD on inter-arrival distributions to cluster. |
| `ENGINE_COORDINATION_INFLUENCE_CAP` | `0.5` | Multiplier on clustered peers' `P_t`. **Calibration note**: the three-peer minimum-honest-majority case needs this tightened to `0.1` so the honest peer can dominate the aggregate. |

## Recommended production defaults

For a federation with two bootstrap peers and active gate-G5 defence:

```sh
PEER_AUTH_ENABLED=true
SCHEMA_VALIDATION_STRICT=true

ENGINE_LOW_TRUST_CUTOFF=0.05
ENGINE_PRE_TRUST_ENABLED=true
ENGINE_PRE_TRUST_PEERS=peer-a-uuid,peer-d-uuid
ENGINE_PRE_TRUST_FLOOR=0.05

ENGINE_COORDINATION_ENABLED=true
ENGINE_COORDINATION_INFLUENCE_CAP=0.1
```

The other defaults are sensible. Tune the EigenTrust parameters only if you have a specific reason; they are well-calibrated for the prototype's scale (a few to a few dozen peers).
