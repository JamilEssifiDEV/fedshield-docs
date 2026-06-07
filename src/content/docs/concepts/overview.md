---
title: How FedShield works
description: The three-layer architecture, the federated trust model, and what the system deliberately does NOT do.
---

FedShield is a small piece of infrastructure that does one thing: it lets independently operated game servers exchange player reputation data through a common protocol, without any central authority holding the record. That sentence carries a lot of design decisions; this page unpacks them.

## The three-layer architecture

The Federation Core is structured in three layers, each with a single responsibility:

```
                ┌────────────────────────────────────────────┐
                │  Game server (peer)                         │
                │   POST /api/v1/events                       │
                └─────────────────┬──────────────────────────┘
                                  │
                ┌─────────────────▼──────────────────────────┐
                │  Event Layer    — ingestion, validation     │
                │                   audit-log persistence     │
                ├─────────────────────────────────────────────┤
                │  Aggregation    — per-peer Bayesian score   │
                │  Layer            time-decay (30-day half)  │
                │                   peer-weighted EigenTrust  │
                │                   coordination defence (G5) │
                ├─────────────────────────────────────────────┤
                │  Policy Layer   — REST API: scores, verdicts│
                │                   advisory only             │
                └─────────────────┬──────────────────────────┘
                                  │
                ┌─────────────────▼──────────────────────────┐
                │  Game server (peer)                         │
                │   GET /api/v1/players/{id}/trust-score     │
                │   Enforcement policy decided in game code   │
                └────────────────────────────────────────────┘
```

**Event Layer.** Validates incoming events against the JSON Schema, persists them to the append-only audit log in PostgreSQL. Idempotent: the same `event_id` submitted twice produces a single stored event.

**Aggregation Layer.** Computes a per-peer Bayesian Beta score on each player, decays older events with a 30-day half-life, then combines per-peer scores into a federation aggregate using EigenTrust-inspired peer weighting. Adversarial peers' reports lose influence proportionally to how much they disagree with the consensus, including under two-peer collusion (gate G5).

**Policy Layer.** Exposes a small REST surface: query a score, query a verdict, register peers. Verdicts are advisory: `trusted` / `neutral` / `suspicious` / `untrusted`. The game server decides what to do with each.

## What FedShield is not

A list of things FedShield deliberately doesn't do, because product clarity matters as much as feature lists.

- **Not a kernel-level anti-cheat.** No driver. No memory scanning. No real-time cheat detection. That's BattlEye, EAC, Riot Vanguard. FedShield consumes the output of whatever your existing detection produces.
- **Not a global ban list.** Each federation group is sovereign. Bans don't propagate across groups. By design.
- **Not binding.** Verdicts are advisory. Your game decides what `untrusted` means in your context — kick, monitor, soft-ban from ranked, anything else.
- **Not a player-facing product.** The dashboard is for operators. Players never see their trust score directly. There's no leaderboard, no "trust rank", no public shaming.

## The federation model

A **federation group** is a small set of game servers that trust each other enough to share reputation signals. Groups are sovereign: each group decides its own identity policy, its own group salt, its own pre-trusted bootstrap peers.

Two servers in the same group can correlate the same player (via group-salted SHA-256 hashes of the platform account ID). Two servers in different groups can NOT correlate the same player. Cross-group correlation is impossible by design.

Within a group, FedShield supports two identity modes:

- **Privacy-First.** Subject identity is a salted hash of the platform account ID. The salt is shared within the group. Best for casual / mid-tier studios.
- **High-Security.** Subject identity is bound to a verified external token (eIDAS, government ID, etc.). Stronger accountability, weaker privacy. Best for regulated markets or competitive ranked play.

The federation is decentralised, but not flat: each group can declare a small set of bootstrap peers whose influence is floored. This is the same trade-off [EigenTrust](https://nlp.stanford.edu/pubs/eigentrust.pdf) (Kamvar 2003, §4.4) made — pure anonymity buys nothing if a Sybil coalition can outvote every honest peer.

## What you build vs what FedShield provides

| You build (per studio) | FedShield provides |
| --- | --- |
| Detection (cheating, toxicity, fraud) | Event schema, ingestion API, audit log |
| Enforcement (kick, ban, soft-ban) | Trust score, verdict, peer weighting |
| Group governance (who joins, salt rotation) | Federation protocol, pseudonymisation |
| Game-specific rules and UX | A small advisory REST surface |

The split is intentional. FedShield never makes a binding decision about your players. You always do.
