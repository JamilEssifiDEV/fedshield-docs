---
title: Peer-weighting and Sybil defence
description: How FedShield resists a malicious peer flooding the federation with false reports — including the two-peer collusion case.
---

The most dangerous failure mode for a federated trust system is a Sybil attack: a malicious peer floods the federation with fabricated events to drive a legitimate player's score to `untrusted`. Without a defence, any peer can effectively veto any player across the entire federation. FedShield's defence is layered.

## The three layers

### Layer 1 — Pairwise agreement (EigenTrust)

Every peer's reports are weighted by **how much they agree with the rest of the federation**. Concretely, the Federation Core builds an agreement matrix where `C[i][j]` is the average pairwise agreement between peer `i`'s and peer `j`'s reports on players they've both observed. Then power iteration with a teleport vector produces a peer-trust vector `P_t` over all peers.

Peers that consistently disagree with the consensus get a low `P_t` and therefore less influence on the aggregate. A single malicious peer flooding false reports against a player whom every honest peer commends will see its `P_t` collapse within a few events.

### Layer 2 — Low-trust cutoff

Peers whose `P_t` falls below a configured threshold (default 0.2) are zeroed out of the federation aggregate entirely. This is the protection against single-source stigmatisation: one rogue peer can't keep contributing reports forever, even if their weight is low.

### Layer 3 — Coordination cluster detection (gate G5)

EigenTrust's honest-majority assumption breaks under coordinated Sybil: two peers that agree with each other while disagreeing with the rest can mutually reinforce each other's `P_t`. FedShield catches this with a separate cluster detector that runs after EigenTrust:

- For every pair of peers, compute the [Jensen-Shannon divergence](https://en.wikipedia.org/wiki/Jensen%E2%80%93Shannon_divergence) (JSD) between their **severity** distributions on shared targets.
- Independently, compute the JSD between their **inter-arrival time** distributions.
- If BOTH JSDs are below threshold (the pair behaves identically on both axes), they form a coordination cluster.
- The cluster's combined influence is multiplied by a cap (default 0.5).

The two-axis requirement is the calibration win: severity-alone false-positives on independent honest reporters of the same cheater (they share severity but not timing), and timing-alone false-positives on any two peers with similar cadence. Requiring both axes rejects both classes.

## The measured result

The thesis paper's Chapter 5 reports the concrete numbers. With two colluding peers (Peer-B + Peer-C) targeting an honest player at lockstep cadence:

| Scenario | Final score | Verdict |
| --- | --- | --- |
| Two-peer collusion, NO defence | 2.2 | untrusted (WRONG) |
| Two-peer collusion, WITH G5 defence | 55.8 | neutral (CORRECT) |
| Two honest peers (false-positive check) | 83.5 | trusted (CORRECT) |

A 53.6-point improvement, and the verdict flipped from wrong (untrusted) to correct (neutral). Two honest peers reporting on the same target were NOT clustered, confirming the false-positive rate stays low.

Full simulation artefacts are in the [federation-core repo](https://github.com/JamilEssifiDEV/federation-core) under `04_Documentation/simulation-runs/coordinated-2026-06-07/`.

## Pre-trusted peers

For federations that include a well-known studio with a track record, the group can declare that studio as a **pre-trusted peer**. Pre-trusted peers have their `P_t` floored at a configurable minimum (default 0.05), so an adversarial coalition can't drive them to zero.

This is exactly the trade-off [Kamvar 2003, §4.4](https://nlp.stanford.edu/pubs/eigentrust.pdf) described: pure anonymity buys nothing if a Sybil coalition can outvote every honest peer. The federation is decentralised, but not flat.

Pre-trust is opt-in. Set `ENGINE_PRE_TRUST_ENABLED=true` and list bootstrap peer IDs in `ENGINE_PRE_TRUST_PEERS`. See [self-host config](/self-host/config/).

## What this does NOT defend against

- **Group-internal collusion across many peers.** Three or more colluders are not yet exercised in the simulation. The detector should generalise (union-find produces a single cluster) but the calibration has only been validated for two-peer collusion.
- **An adversary that compromises a pre-trusted peer.** Pre-trust assumes the bootstrap set behaves honestly. Compromising one means compromising the federation's anchor. Operational security on pre-trusted peers matters.
- **Replay attacks against the audit log.** Each event has a UUID `event_id` that the Federation Core deduplicates on. Ed25519 signing (Phase 2) adds tamper-evidence to this.
- **Off-protocol attacks.** Social engineering a studio's ops team into flagging legitimate players. No technical defence helps here.

These are real attack surfaces. They are also future work, documented in the thesis paper's Outlook section.
