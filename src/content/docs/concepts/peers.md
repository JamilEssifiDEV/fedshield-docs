---
title: Peers and federation groups
description: How game servers identify themselves to FedShield and to each other.
---

A **peer** is any game server (or studio backend) that talks to a Federation Core. Peers submit trust events and query trust scores. Peers don't see each other's raw events; they only see the aggregated federation output.

## Peer registration

A peer registers once per Federation Core instance. Registration returns:

- `peer_id` — a UUIDv4 the Federation Core assigns. Use this as the `peer_id` field in every event you submit.
- `api_key` — a secret string. Include it in the `X-Peer-API-Key` header on every authenticated request. Treat it like a database password.
- `status` — `active` on first registration. Can become `suspended` or `revoked` if the operator intervenes.

```sh
curl -X POST http://localhost:8080/api/v1/peers/register \
  -H "Content-Type: application/json" \
  -d '{
    "peer_name": "Studio Apex Game Server",
    "game_ids": ["apex-multiplayer"],
    "contact_email": "ops@apex.example"
  }'
```

Peer registration is currently NOT idempotent on `peer_name`: re-registering the same name creates a new UUID and a new API key. This is a known limitation — if you're scripting deployments, persist the `peer_id` after first registration and reuse it.

## Federation groups

A peer doesn't exist in isolation. Peers belong to a **federation group** — a small set of game servers that have agreed to share reputation signals among themselves.

Groups are sovereign:

- Each group decides who joins.
- Each group declares its own **group salt** (used for subject pseudonymisation).
- Each group declares its own **pre-trusted peer set** (used for Sybil resistance).
- Each group's events stay within the group: federation does not propagate across groups.

In practice, group membership is operational — a peer joins a group by being configured with the group's shared salt and pointing at the group's Federation Core URL. There is no on-chain registry, no global directory.

## Group salt and subject pseudonymisation

Subjects (players) are identified across peers via group-salted SHA-256 hashes:

```
subject_hash = SHA-256(platform_account_id || group_salt)
```

The group salt is shared among group members but not across groups. Consequences:

- **Within a group:** Studio A's hash of player "alice123" matches Studio B's hash of player "alice123". They can correlate the same player.
- **Across groups:** Studio A's hash and Studio C's hash for the same player are completely different values. Cross-group correlation is computationally infeasible.

This is **scoped pseudonymisation**: privacy is preserved across groups, accountability is preserved within a group. The trade-off is documented in [Chapter 3.6 of the thesis paper](https://github.com/JamilEssifiDEV/fedshield-thesis).

## Identity modes

Each federation group chooses one of two identity modes when it's formed:

### Privacy-First

The input to the hash is whatever opaque account ID the platform provides. Steam IDs, Riot IDs, Apex IDs, Battle.net IDs. The platform's deduplication is what FedShield consumes.

- Strong privacy across groups.
- Vulnerable to identity recycling: a banned player can create a new platform account and reset their reputation.
- Best for casual or mid-tier studios.

### High-Security

The input to the hash is a verified external identity token (eIDAS, government-issued ID, KYC verification). The platform-account-ID layer is bypassed.

- Strong accountability: a banned player can't create a new identity without re-doing the verification.
- Weaker privacy: the verifying authority knows who you are.
- Best for regulated markets (gambling-adjacent ranked play, esports tournaments).

A group picks ONE mode. Mixing within a group is not supported.

## Pre-trusted peers

Within a group, the federation can declare a small set of **pre-trusted peers** (typically 1-3) whose influence in the peer-trust calculation is floored. These are well-known studios with a track record — the EigenTrust paper's original solution to Sybil attacks (Kamvar 2003, §4.4).

Pre-trust is opt-in: a freshly-deployed Federation Core has no pre-trusted peers by default. To enable it, set the `ENGINE_PRE_TRUST_*` environment variables. See the [configuration reference](/self-host/config/).

A group without pre-trusted peers still defends against single-adversary Sybil attacks via the peer-weighting mechanism. It's only against coordinated two-peer collusion (gate G5) that pre-trust becomes load-bearing.
