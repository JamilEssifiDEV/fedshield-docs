---
title: C# / .NET
description: Minimal HttpClient integration for Unity, Unreal C# bindings, or any .NET 6+ backend.
---

There's no published NuGet SDK yet. The Federation Core API is small enough that `HttpClient` and `System.Text.Json` cover it cleanly. The example below works on .NET 6+, Mono, and Unity 2022+.

## Minimal client

```csharp
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

public sealed class FedShieldClient
{
    private readonly HttpClient http;
    private readonly string peerId;
    private readonly string gameId;

    public FedShieldClient(string baseUrl, string apiKey, string peerId, string gameId)
    {
        http = new HttpClient { BaseAddress = new Uri(baseUrl) };
        http.DefaultRequestHeaders.Add("X-Peer-API-Key", apiKey);
        http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        this.peerId = peerId;
        this.gameId = gameId;
    }

    public async Task<SubmitResult> SubmitEventAsync(
        string eventType,
        string playerId,
        double severity,
        CancellationToken ct = default)
    {
        var body = new TrustEvent
        {
            SchemaVersion = "1.0.0",
            EventId = Guid.NewGuid().ToString(),
            EventType = eventType,
            PeerId = peerId,
            PlayerId = playerId,
            GameId = gameId,
            Severity = severity,
            Timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"),
        };

        var res = await http.PostAsJsonAsync("/api/v1/events", body, ct);

        // 409 means "already stored" — that's a successful idempotent retry.
        if (res.StatusCode == System.Net.HttpStatusCode.Conflict)
        {
            return new SubmitResult { Accepted = false, Duplicate = true };
        }
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<SubmitResult>(cancellationToken: ct))!;
    }

    public async Task<TrustScore> GetTrustScoreAsync(string playerId, CancellationToken ct = default)
    {
        var res = await http.GetAsync($"/api/v1/players/{Uri.EscapeDataString(playerId)}/trust-score", ct);
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<TrustScore>(cancellationToken: ct))!;
    }
}

public sealed class TrustEvent
{
    [JsonPropertyName("schema_version")] public string SchemaVersion { get; set; } = "";
    [JsonPropertyName("event_id")]       public string EventId { get; set; } = "";
    [JsonPropertyName("event_type")]     public string EventType { get; set; } = "";
    [JsonPropertyName("peer_id")]        public string PeerId { get; set; } = "";
    [JsonPropertyName("player_id")]      public string PlayerId { get; set; } = "";
    [JsonPropertyName("game_id")]        public string GameId { get; set; } = "";
    [JsonPropertyName("severity")]       public double Severity { get; set; }
    [JsonPropertyName("timestamp")]      public string Timestamp { get; set; } = "";
}

public sealed class SubmitResult
{
    [JsonPropertyName("accepted")]  public bool Accepted { get; set; }
    [JsonPropertyName("duplicate")] public bool Duplicate { get; set; }
}

public sealed class TrustScore
{
    [JsonPropertyName("player_id")]    public string PlayerId { get; set; } = "";
    [JsonPropertyName("score")]        public double Score { get; set; }
    [JsonPropertyName("confidence")]   public double Confidence { get; set; }
    [JsonPropertyName("verdict")]      public string Verdict { get; set; } = "";
    [JsonPropertyName("event_count")]  public int EventCount { get; set; }
    [JsonPropertyName("last_updated")] public string LastUpdated { get; set; } = "";
}
```

## Use it from your game server

```csharp
var client = new FedShieldClient(
    baseUrl: "http://localhost:8080",
    apiKey:  Environment.GetEnvironmentVariable("FEDSHIELD_API_KEY")!,
    peerId:  Environment.GetEnvironmentVariable("FEDSHIELD_PEER_ID")!,
    gameId:  "my-game");

// When something happens in your game:
await client.SubmitEventAsync("report_cheating", "player-alice-123", 0.85);

// Before matchmaking:
var score = await client.GetTrustScoreAsync("player-alice-123");
if (score.Verdict == "untrusted" && score.Confidence >= 0.5)
{
    // Apply your policy.
}
```

## Unity-specific notes

- On older Unity versions (2021 LTS), `HttpClient` works but consider using `UnityWebRequest` for better integration with Unity's main thread. The semantics map 1:1.
- Use `JsonUtility` if you can't add System.Text.Json. The example payload is small enough to hand-serialise.
- `Guid.NewGuid()` is safe in Unity. `DateTime.UtcNow` is too.
- Run the FedShield calls on a background thread via `Task.Run` or Unity's async/await pattern; never block the main thread on network I/O.

## Long-lived client

Create one `FedShieldClient` per process. `HttpClient` is designed to be a singleton: instantiating a new one per request leaks socket handles on .NET Framework and can starve the connection pool on .NET 6+ under load.
