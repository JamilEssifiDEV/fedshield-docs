---
title: Errors
description: Every HTTP status the Federation Core can return, what it means, and how to recover.
---

The Federation Core uses standard HTTP status codes. Error responses follow a single JSON shape:

```json
{
  "error": "human-readable description of what went wrong",
  "code": "machine_readable_error_code",
  "details": { ... }
}
```

The `code` field is stable across versions; the `error` text is for humans and may be reworded. The `details` object is optional and only included for specific error types (e.g., validation errors include the offending field path).

## 2xx — success

| Status | When | Body |
| --- | --- | --- |
| `200 OK` | GET endpoints succeeded | The requested resource |
| `201 Created` | `POST /events`, `POST /peers/register` succeeded | The created resource |

## 4xx — client errors

These mean the request is wrong. Fix the request and retry; retrying without changes will fail again.

### 400 Bad Request

The request body failed JSON Schema validation. `details.field` indicates which field, `details.violation` describes the constraint.

```json
{
  "error": "schema validation failed: severity must be in [0, 1]",
  "code": "schema_validation_failed",
  "details": {
    "field": "/severity",
    "violation": "maximum",
    "actual": 1.5,
    "limit": 1.0
  }
}
```

Common causes: severity out of range, missing required field, unknown `event_type`, unrecognised field (with `additionalProperties: false`).

### 401 Unauthorized

The `X-Peer-API-Key` header is missing or doesn't match any peer. See [authentication](/api/auth/).

### 403 Forbidden

The API key is valid but the peer's status is `suspended` or `revoked`. Contact the federation operator.

### 404 Not Found

The requested player has no events in the Federation Core. Note: this is different from a player who has events but a neutral score. A 404 means "we've never heard of this player ID"; a 200 with `verdict: neutral` and `confidence: 0` means "we know who you mean but we have no signal".

### 409 Conflict

Used for duplicate event submissions. The response includes the original event:

```json
{
  "error": "event already exists",
  "code": "duplicate_event",
  "details": {
    "event_id": "evt-7a8b9c0d-...",
    "originally_received_at": "2026-06-07T18:00:00Z"
  }
}
```

This is not a failure — your idempotent retry succeeded. Treat 409 as "the event is stored; you can stop retrying".

### 422 Unprocessable Entity

The request is structurally valid but semantically rejected. Examples:

- Event timestamp more than 24 hours in the future.
- `peer_id` in the event body doesn't match the authenticated peer.
- `game_id` not in the registered `game_ids` for this peer.

## 5xx — server errors

These mean something failed on FedShield's side. Retrying is reasonable, with exponential backoff.

### 500 Internal Server Error

An unhandled exception. The response includes a request ID:

```json
{
  "error": "internal server error",
  "code": "internal_error",
  "details": { "request_id": "req-7a8b9c0d-..." }
}
```

Include the `request_id` if you file a bug report — it's the join key for the server-side logs.

### 503 Service Unavailable

The Federation Core can't reach PostgreSQL or Redis. Retry after a short delay. The response includes `Retry-After` (in seconds) when known.

## Idempotent retries

`POST /events` is fully idempotent on `event_id`. Retrying the same body produces:

- `201` with the original response (if the original write succeeded but the response was lost)
- `409` indicating the event was already stored (the retry is a no-op)

Either way, your client should treat retries as safe. Use a UUIDv4 for `event_id`.

`GET` endpoints are naturally idempotent. `POST /peers/register` is NOT currently idempotent on `peer_name` — re-registering creates a new peer. Persist the `peer_id` after first registration and don't re-register.

## Rate limiting

Phase 1 has no rate limiting in the Federation Core itself. Phase 2 will introduce per-peer rate limits (defaults TBD) and return `429 Too Many Requests` when exceeded. Until then, be a good citizen — there's no enforcement, but the audit log is a public record within the federation.
