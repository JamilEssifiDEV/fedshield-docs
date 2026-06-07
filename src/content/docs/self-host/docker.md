---
title: Run with Docker
description: Stand up PostgreSQL, Redis, and the Federation Core in under a minute.
---

The Federation Core repo ships a `docker-compose.yml` that brings up Postgres 16, Redis 7, and (optionally) the Federation Core binary itself. The compose file is what the team uses for local development; it's also fine for a single-node production install on a small studio.

## Prerequisites

- Docker Engine 24+ with Compose v2.
- 2 GB of RAM minimum for the three containers under light load.
- An open port (8080 by default for the Federation Core HTTP API).

## Three-command setup

```sh
git clone https://github.com/JamilEssifiDEV/federation-core
cd federation-core
cp .env.example .env
make docker-up
```

This starts Postgres and Redis. Database migrations are auto-applied on Postgres first boot via the `scripts/migrations/` directory mounted into `/docker-entrypoint-initdb.d`.

To also run the Federation Core inside Docker (instead of building locally):

```sh
docker compose --profile app up -d
```

Without the `--profile app` flag, only Postgres + Redis come up — useful if you want to run the Go binary locally with `make run` for faster iteration.

## Verify it's running

```sh
docker compose ps
# Postgres and Redis show "Up (healthy)"

curl http://localhost:8080/api/v1/health
# {"status":"ok","service":"federation-core"}
```

## Persistence

The compose file declares two named volumes:

- `postgres_data` — PostgreSQL data directory, survives `docker compose down`.
- `redis_data` — Redis AOF persistence, survives restarts.

To wipe everything and start fresh:

```sh
make docker-reset
# OR: docker compose down -v
```

This deletes both volumes. Useful between simulation runs; dangerous on a production install.

## Port mapping

By default the compose file maps:

| Service | Container port | Host port |
| --- | --- | --- |
| Postgres | 5432 | **5433** |
| Redis | 6379 | 6379 |
| Federation Core | 8080 | 8080 |

The Postgres port is 5433 on the host because a lot of developers already have a 5432 running locally. Change `5433:5432` in `docker-compose.yml` if you want it on the standard port.

## Configuration

All runtime configuration is via environment variables. `.env.example` lists every variable with a sensible default. Override in `.env` (or wherever your platform reads env vars from). See the [configuration reference](/self-host/config/) for the full list.

The most important defaults to override before production:

```sh
PEER_AUTH_ENABLED=true                # default false is for local dev ONLY
DB_PASSWORD=<generate a strong one>   # default is 'fedshield_dev'
ENGINE_COORDINATION_ENABLED=true      # opt in to gate G5 defence
ENGINE_PRE_TRUST_ENABLED=true         # if your federation has bootstrap peers
ENGINE_PRE_TRUST_PEERS=<uuid,uuid>    # the bootstrap peer IDs
```

## Production-readiness checklist

This is a prototype, not a hardened production system. Before you put it in front of real users:

- **Run behind TLS.** The Federation Core speaks plain HTTP. Put it behind Caddy, Nginx, or a load balancer doing TLS termination.
- **Take real backups of Postgres.** The named volume is not a backup strategy. Use `pg_dump` on a schedule, or replicate to a managed Postgres.
- **Set strong DB credentials.** The default `fedshield_dev` password is in the repo.
- **Disable `PEER_AUTH_ENABLED=false`.** It's the local-dev convenience. Anyone who can reach the API can impersonate any peer with it off.
- **Monitor the audit log size.** Trust events are append-only. Plan for archival (the event log retains everything; only the time-decay weight makes old events stop influencing scores).
- **Run two replicas at minimum.** A single Federation Core is a single point of failure. Stateless replicas behind a load balancer can share the Postgres + Redis tier.

These are not yet documented in detail; deployment hardening is a Phase 2 deliverable.

## Logs and observability

The Federation Core writes structured JSON logs to stdout. `docker compose logs -f federation-core` streams them. The fields you want to follow:

- `msg=http method=POST path=/api/v1/events status=201` — successful event ingest.
- `msg=http method=GET path=/api/v1/players/.../trust-score` — every score query.
- `msg=error` — anything bad; the `error` field has the message.

No metrics endpoint yet (Prometheus integration is Phase 2 work). For now, `docker stats` and the log stream are the operational signals.
