---
title: Go
description: Minimal Go example for integrating FedShield into a game server.
---

The Federation Core ships a small Go client in the same repository at [`cmd/simulations/internal/simclient`](https://github.com/JamilEssifiDEV/federation-core/tree/main/cmd/simulations/internal/simclient). It's not a published SDK yet, but the package is import-safe today.

## Install

```sh
go get github.com/JamilEssifiDEV/federation-core@latest
```

## Complete example

The whole integration in under 50 lines:

```go
package main

import (
	"context"
	"fmt"
	"log"

	"github.com/JamilEssifiDEV/federation-core/cmd/simulations/internal/simclient"
)

func main() {
	ctx := context.Background()

	// Construct the client. Use your federation's Federation Core URL.
	client := simclient.New("http://localhost:8080")

	// Health check before doing anything else.
	if err := client.Health(ctx); err != nil {
		log.Fatalf("federation core not reachable: %v", err)
	}

	// Register your peer (first run only — persist the api_key afterwards).
	reg, err := client.Register(ctx,
		"My Game Server",
		[]string{"my-game"},
		"ops@mystudio.example")
	if err != nil {
		log.Fatalf("register: %v", err)
	}
	fmt.Printf("registered peer_id=%s\n", reg.PeerID)

	// Attach the API key for subsequent calls.
	client = client.WithAPIKey(reg.APIKey)

	// Submit a trust event when something happens in your game.
	event := simclient.ReportCheating(
		reg.PeerID,
		"player-alice-123",
		"my-game",
		0.85, // severity in [0, 1]
	)
	result, err := client.SubmitEvent(ctx, &event)
	if err != nil {
		log.Fatalf("submit: %v", err)
	}
	fmt.Printf("submitted event_id=%s accepted=%v\n", event.EventID, result.Accepted)

	// Query the trust score for any player your game cares about.
	score, err := client.GetTrustScore(ctx, "player-alice-123")
	if err != nil {
		log.Fatalf("score: %v", err)
	}
	fmt.Printf("player score=%.1f verdict=%s confidence=%.2f\n",
		score.Score, score.Verdict, score.Confidence)
}
```

## Apply enforcement policy

The score is advisory. Your game decides what to do:

```go
func decideMatchmakingPolicy(score *simclient.TrustScore) string {
	if score.Confidence < 0.2 {
		// Not enough history — treat as neutral.
		return "ranked_allowed"
	}
	switch score.Verdict {
	case "trusted":
		return "ranked_allowed"
	case "neutral":
		return "ranked_allowed"
	case "suspicious":
		return "ranked_locked_24h"
	case "untrusted":
		return "ranked_locked_permanent"
	default:
		return "ranked_allowed"
	}
}
```

## Helpers for the nine event types

The client package exposes a constructor per event type so you don't have to hand-build `TrustEvent` literals:

```go
simclient.ReportCheating(peerID, playerID, gameID, 0.85)
simclient.ReportToxicity(peerID, playerID, gameID, 0.6)
simclient.ReportSpam(peerID, playerID, gameID, 0.4)
simclient.FriendlyFire(peerID, playerID, gameID, 0.5)
simclient.SessionAnomaly(peerID, playerID, gameID, 0.7)
simclient.MatchmakingFraud(peerID, playerID, gameID, 0.8)
simclient.BanApplied(peerID, playerID, gameID, 1.0)
simclient.BanLifted(peerID, playerID, gameID, 0.6)
simclient.Commendation(peerID, playerID, gameID, 0.7)
```

Each constructor fills in `event_id` (UUIDv4), `schema_version`, and `timestamp` (now in UTC). Override any field after construction if you need to (e.g., replay an historical event with its original timestamp).

## Persisting credentials

The example above re-registers on every run. In production, register once, persist `peer_id` and `api_key` to your secrets store, and instantiate the client like this on subsequent runs:

```go
client := simclient.New("http://localhost:8080").
	WithAPIKey(os.Getenv("FEDSHIELD_API_KEY"))
peerID := os.Getenv("FEDSHIELD_PEER_ID")
// proceed straight to SubmitEvent / GetTrustScore using peerID
```
