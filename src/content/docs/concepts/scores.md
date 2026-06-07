---
title: Trust scores and verdicts
description: What the 0-100 number means, how the four verdict bands are defined, and what 'advisory' really implies.
---

A trust score is a single floating-point number in `[0, 100]` describing the Federation Core's current estimate of a player's reputation across the federation. The score is paired with a **verdict** — one of four bands that simplifies the number into an action category.

## The score

```
score = 100 × posAcc / (posAcc + negAcc)
```

Where `posAcc` and `negAcc` are time-decayed accumulators of positive and negative event contributions, each seeded with a Bayesian prior of 1.0. A player with no events at all has `posAcc = negAcc = 1.0`, score `= 50.0` (neutral).

### Useful properties

- **Bounded.** Always in `[0, 100]`.
- **Bayesian.** New players don't get penalised for having no history; they default to neutral.
- **Time-decayed.** Events older than 30 days carry half their original weight; older than 60 days, a quarter. A clean year of behaviour effectively erases an old ban.
- **Deterministic.** Same events, same configuration, same time reference → same score, bit-identical.

### Confidence

Every score response includes a `confidence` value in `[0, 1]`:

```
confidence = min(1, event_count / 20)
```

Confidence saturates at 20 events. Below that, treat the score as preliminary — there isn't enough evidence to make a strong decision either way.

## The four verdicts

The verdict bucketises the score for downstream consumption. The boundaries are:

| Verdict | Score range | What it means |
| --- | --- | --- |
| `trusted` | 70 – 100 | Strong positive signal. Play freely. |
| `neutral` | 35 – 70 | No strong signal in either direction. Default for new players. |
| `suspicious` | 20 – 35 | Negative signal worth attention. Consider soft restrictions (ranked locked, etc.). |
| `untrusted` | 0 – 20 | Strong negative signal. Most enforcement actions land here. |

The verdict is included in every score response so client code doesn't have to re-implement the band boundaries:

```json
{
  "player_id": "player-alice-123",
  "score": 18.4,
  "confidence": 0.85,
  "verdict": "untrusted",
  "event_count": 17,
  "last_updated": "2026-06-07T18:00:00Z"
}
```

## Advisory, not binding

This is the most important property of FedShield, and the one that keeps the system politically viable. A verdict tells your game server what the federation thinks. Your game server decides what to do with that information.

A `untrusted` verdict does NOT:

- Disconnect the player from your game.
- Apply a ban.
- Trigger any action in another federation peer.
- Get propagated to third-party services.

A `untrusted` verdict DOES:

- Show up in your `/api/v1/players/{id}/trust-score` response.
- Get included in your dashboard's live event stream.
- Inform whatever policy YOU coded into your game server.

If you want `untrusted` to mean "block from ranked", code that. If you want it to mean "extra spectator review for the next 24 hours", code that. FedShield never bans anyone for you.

## The three-stage hybrid (where the score actually comes from)

A full score query runs through three stages:

### Stage 1 — Per-peer Bayesian Beta

For each peer that has reported on this player, compute that peer's own opinion using the Bayesian formula above. Time decay is applied per event.

### Stage 2 — Peer-weighted federation aggregate

Combine the per-peer opinions using EigenTrust-style weighting:

```
T_r(player) = Σ_i (s_i × P_t,i) / Σ_i P_t,i
```

Where `s_i` is peer `i`'s score for the player and `P_t,i` is peer `i`'s peer-trust value (computed from pairwise agreement across the whole federation). Peers that consistently disagree with the consensus get a lower `P_t,i` and therefore less influence on the aggregate.

The coordination defence (gate G5) adds a cluster detector to this stage: pairs of peers whose submission patterns are statistically near-identical are flagged as a coordination cluster, and their combined influence is capped.

### Stage 3 — Local policy weighting (optional, not yet implemented)

Each consuming peer can blend the federation aggregate with their own direct trust signal:

```
S = α × T_d + β × T_r
```

Where `T_d` is the local peer's own opinion of the player. This stage is reserved for a future release; today the API returns `T_r` directly (the β=1, α=0 degenerate case).

## Score recomputation

Trust scores are recomputed on every read. There is no cron job, no background refresh, no eventual consistency window: when you `GET /api/v1/players/{id}/trust-score`, the score you receive is computed from the current state of the event log at request time.

The computed score is also persisted to the `trust_scores` table for fast verdict queries, but the persistence is asynchronous and never blocks the response.
