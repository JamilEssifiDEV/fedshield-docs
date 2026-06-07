---
title: Trust events
description: The nine event types, their severities, and what they describe (not what they decide).
---

A **trust event** is a single observation about a single player at a single point in time. Events are **descriptive**, not directive: an event says "this happened", it doesn't say "ban this player". Decisions about enforcement are made by the game server consuming the trust score, not by the event submitter.

## The nine event types

Events fall into nine fixed types. The list is closed by JSON Schema: a tenth type cannot be silently introduced.

### Negative (reduce the trust score)

| Event type | Use case | Typical severity |
| --- | --- | --- |
| `report_cheating` | Other player reported, your anti-cheat flagged, manual review found cheating | 0.7 – 1.0 |
| `report_toxicity` | Chat moderation flag, manual report for harassment | 0.4 – 0.8 |
| `report_spam` | Chat spam, lobby spam, friend-request spam | 0.3 – 0.6 |
| `friendly_fire` | Team-griefing, intentional team damage | 0.3 – 0.7 |
| `ban_applied` | Studio applied a ban (any duration). Maximum signal. | 1.0 |
| `session_anomaly` | Telemetry anomaly suggesting cheating (impossible movement, etc.) | 0.5 – 0.9 |
| `matchmaking_fraud` | Smurfing, account boosting, ELO manipulation | 0.6 – 1.0 |

### Positive (raise the trust score)

| Event type | Use case | Typical severity |
| --- | --- | --- |
| `commendation` | Player received a positive commendation from teammates | 0.5 – 1.0 |
| `ban_lifted` | A previous ban was overturned (e.g., false positive, appeal accepted) | 0.5 – 1.0 |

## Event shape

```json
{
  "schema_version": "1.0.0",
  "event_id": "evt-7a8b9c0d-e1f2-3a4b-5c6d-7e8f9a0b1c2d",
  "event_type": "report_cheating",
  "peer_id": "ad2e1e0f-7279-4013-9a0c-3a8a4ecde248",
  "player_id": "player-alice-123",
  "game_id": "my-game",
  "severity": 0.85,
  "timestamp": "2026-06-07T18:00:00Z",
  "metadata": {
    "report_source": "anti-cheat",
    "review_status": "automated"
  }
}
```

### Required fields

| Field | Type | Notes |
| --- | --- | --- |
| `schema_version` | string | Currently always `"1.0.0"` |
| `event_id` | string | A UUID you generate. Used for idempotency: submitting the same `event_id` twice produces one stored event. |
| `event_type` | enum | One of the nine types above |
| `peer_id` | UUID | YOUR peer ID from registration |
| `player_id` | string | Opaque player identifier in YOUR game. The Federation Core does not interpret this; pseudonymisation happens at the federation-group boundary. |
| `game_id` | string | One of the `game_ids` you registered |
| `severity` | float | `[0, 1]`, normalised. See per-type ranges above. |
| `timestamp` | RFC 3339 | Event time, NOT submission time. The Aggregation Layer uses this for time decay. |

### Optional fields

| Field | Type | Notes |
| --- | --- | --- |
| `metadata` | object | Free-form. Persisted in the audit log, ignored by the scoring engine. |
| `signature` | string | Ed25519 signature over the event body. Required when `PEER_AUTH_ENABLED=true`. Reserved for Phase 2 hardening. |

## What MUST NOT be in an event

Personally identifiable information is forbidden at the JSON Schema boundary. The schema's `additionalProperties: false` constraint rejects any field outside the declared shape with HTTP 400.

Don't submit:

- Real names
- Email addresses
- IP addresses
- Phone numbers
- Government-issued identifiers
- Postal addresses
- Dates of birth
- Platform-issued account tokens (the platform account ID is fine; the access token is not)

The `player_id` field MUST be an opaque identifier in your game's namespace. If you must pass a hashed platform account ID, hash it BEFORE submitting (the Federation Core does not hash for you).

## Idempotency and replay safety

Every event carries a UUID `event_id`. The Federation Core deduplicates on this ID: submitting the same event twice produces one persisted event and returns `"duplicate": true` on the second call.

This is the mechanism that makes peer-to-peer retransmission safe: if your game server crashes mid-submission, replay the same event with the same `event_id` and the second attempt won't double-count.

In Phase 2 (Ed25519 signing), the schema also enforces that a previously-signed event can't be modified and resubmitted as a "new" event. Today (Phase 1), this protection is documented but not enforced.

## What the scoring engine does with events

Each event contributes a signed weight to one of two accumulators:

- **Positive accumulator** (commendations, ban-lifts)
- **Negative accumulator** (everything else)

The weight is `|base_weight| × severity × decay(age)`, where:

- `base_weight` is a fixed per-event-type weight in the range `(-1, 1]`.
- `severity` is the value you submitted in `[0, 1]`.
- `decay(age) = exp(-ln(2) × age_days / 30)` — exponential decay with a 30-day half-life.

The final score is `100 × posAcc / (posAcc + negAcc)`, normalised to `[0, 100]`. See [scores and verdicts](/concepts/scores/) for what the numbers actually mean.
