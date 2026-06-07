---
title: Authentication
description: API keys, header format, and the Phase 2 Ed25519 signing roadmap.
---

FedShield uses pre-shared API keys for peer authentication in Phase 1, with Ed25519 request signing planned for Phase 2.

## API keys

Every peer receives an `api_key` on first registration:

```sh
curl -X POST http://localhost:8080/api/v1/peers/register \
  -H "Content-Type: application/json" \
  -d '{
    "peer_name": "Studio Apex Game Server",
    "game_ids": ["apex-multiplayer"],
    "contact_email": "ops@apex.example"
  }'
```

```json
{
  "peer_id": "ad2e1e0f-7279-4013-9a0c-3a8a4ecde248",
  "api_key": "sk_live_a8b9c0d1e2f3...",
  "status": "active"
}
```

Treat the `api_key` like a database password:

- Store it in a secrets manager, not in source control.
- Rotate it if you suspect compromise (currently a manual operator action).
- Use a different key per environment (dev / staging / prod each have their own Federation Core).

## Including the key on requests

Add the `X-Peer-API-Key` header to every authenticated request:

```sh
curl -X POST http://localhost:8080/api/v1/events \
  -H "Content-Type: application/json" \
  -H "X-Peer-API-Key: sk_live_a8b9c0d1e2f3..." \
  -d '{ ... }'
```

In Go (via the shipped simclient):

```go
client = client.WithAPIKey(reg.APIKey)
// Every subsequent SubmitEvent, GetTrustScore, etc. now carries the header.
```

## Which endpoints require auth

| Endpoint | Authentication |
| --- | --- |
| `GET /api/v1/health` | None |
| `POST /api/v1/peers/register` | None (this is how you GET your key) |
| `GET /api/v1/peers` | API key required |
| `POST /api/v1/events` | API key required |
| `GET /api/v1/players/{id}/trust-score` | API key required |
| `GET /api/v1/players/{id}/verdict` | API key required |

## Local development bypass

For local development, set `PEER_AUTH_ENABLED=false` in your `.env`. With auth disabled, all endpoints accept requests without an `X-Peer-API-Key` header. This is the **default** for the `.env.example` shipped in the repo.

Never deploy `PEER_AUTH_ENABLED=false` to production. Without auth, any caller can submit events impersonating any peer.

## What happens on auth failure

- Missing or empty `X-Peer-API-Key` on an authenticated endpoint: HTTP 401 with `{"error": "missing api key"}`.
- Invalid key (no matching peer): HTTP 401 with `{"error": "invalid api key"}`.
- Suspended or revoked peer: HTTP 403 with `{"error": "peer not active"}`.

The 401 vs 403 distinction matters: 401 means "your credentials don't match a peer", 403 means "your credentials match a peer but that peer is not allowed to act".

## Phase 2 — Ed25519 request signing

Phase 1's pre-shared-key model is appropriate for early-stage federations where the participants know each other operationally. As federations scale or include peers across organisational trust boundaries, request signing provides stronger guarantees:

- **Non-repudiation:** A signed event proves which peer submitted it. The audit log becomes evidence in disputes.
- **Tamper evidence:** Modifying a signed event in transit invalidates the signature.
- **Replay resistance:** The signature includes a timestamp; replays outside the freshness window are rejected.

Phase 2 will use Ed25519 with each peer's public key registered alongside the peer record. The migration path is opt-in via `PEER_AUTH_ENABLED=true` once the implementation lands. Until then, the `signature` field in the event schema is reserved but not validated.
