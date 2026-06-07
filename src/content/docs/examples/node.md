---
title: Node.js / TypeScript
description: Minimal Node example using fetch. No SDK required.
---

There's no published Node SDK yet, but the API is small enough that `fetch` is the right tool. The example below works on Node 20+ (built-in fetch) and on any modern browser-side runtime.

## Minimal client (TypeScript)

```ts
// fedshield.ts
const BASE_URL = process.env.FEDSHIELD_URL ?? 'http://localhost:8080';
const API_KEY = process.env.FEDSHIELD_API_KEY!;
const PEER_ID = process.env.FEDSHIELD_PEER_ID!;
const GAME_ID = process.env.FEDSHIELD_GAME_ID!;

type EventType =
  | 'report_cheating'
  | 'report_toxicity'
  | 'report_spam'
  | 'friendly_fire'
  | 'session_anomaly'
  | 'matchmaking_fraud'
  | 'ban_applied'
  | 'ban_lifted'
  | 'commendation';

export interface TrustEvent {
  schema_version: '1.0.0';
  event_id: string;
  event_type: EventType;
  peer_id: string;
  player_id: string;
  game_id: string;
  severity: number;
  timestamp: string;
}

export interface TrustScore {
  player_id: string;
  score: number;
  confidence: number;
  verdict: 'trusted' | 'neutral' | 'suspicious' | 'untrusted';
  event_count: number;
  last_updated: string;
}

export async function submitEvent(
  type: EventType,
  playerId: string,
  severity: number,
): Promise<{ accepted: boolean; duplicate: boolean }> {
  const event: TrustEvent = {
    schema_version: '1.0.0',
    event_id: crypto.randomUUID(),
    event_type: type,
    peer_id: PEER_ID,
    player_id: playerId,
    game_id: GAME_ID,
    severity,
    timestamp: new Date().toISOString(),
  };

  const res = await fetch(`${BASE_URL}/api/v1/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Peer-API-Key': API_KEY,
    },
    body: JSON.stringify(event),
  });

  if (!res.ok && res.status !== 409) {
    throw new Error(`submit failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function getScore(playerId: string): Promise<TrustScore> {
  const res = await fetch(
    `${BASE_URL}/api/v1/players/${encodeURIComponent(playerId)}/trust-score`,
    { headers: { 'X-Peer-API-Key': API_KEY } },
  );
  if (!res.ok) {
    throw new Error(`score failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
```

## Use it from your game server

```ts
import { submitEvent, getScore } from './fedshield';

// When something happens in your game:
await submitEvent('report_cheating', 'player-alice-123', 0.85);

// Before matchmaking:
const score = await getScore('player-alice-123');
if (score.verdict === 'untrusted' && score.confidence >= 0.5) {
  // Apply your policy — kick from ranked, queue separately, whatever.
}
```

## Handling 409 (duplicate)

The `submit` helper above lets 409 through because a duplicate event submission is success, not failure. The Federation Core returns 409 when the same `event_id` is replayed, including the original `received_at`. Treat 409 the same as 201.

```ts
const result = await submitEvent('report_cheating', 'alice-123', 0.85);
if (result.duplicate) {
  console.log('event already stored; retry was a no-op');
}
```

## A Note on Node-specific globals

- `crypto.randomUUID()` is built-in on Node 18+ and in modern browsers. On older Node, install `uuid` and use `uuidv4()`.
- `fetch` is built-in on Node 18+. On older Node, use `undici` or `node-fetch`.
- `process.env` reading happens at module load — for a production setup, pass these as injected config to the module instead.
