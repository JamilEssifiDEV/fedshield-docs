# FedShield developer portal

The public documentation and API reference for [FedShield](https://github.com/JamilEssifiDEV/federation-core) — a federated trust infrastructure for online multiplayer games.

Live at **<https://fedshield-docs.pages.dev>** (deployed via Cloudflare Pages).

## What's in here

- **Getting started** — quickstart in curl + Go, five minutes from clone to verdict.
- **Concepts** — three-layer architecture, peers and federation groups, trust events, scores and verdicts, peer-weighting + Sybil defence.
- **API reference** — interactive Scalar viewer over the OpenAPI 3.1 spec.
- **Code examples** — minimal client snippets in Go, Node/TypeScript, and C#/.NET.
- **Self-host** — Docker compose + configuration reference.

## Local development

```sh
npm install
npm run dev    # http://localhost:4321
npm run build  # static output to dist/
```

Built with [Astro Starlight](https://starlight.astro.build/).

## How the OpenAPI spec gets here

The canonical spec lives in the [federation-core repo](https://github.com/JamilEssifiDEV/federation-core/blob/main/docs/openapi/openapi.yaml). We copy it into `public/openapi.yaml` and Scalar renders it on the API Reference page.

To sync the latest:

```sh
cp ../01_Federation-Core/docs/openapi/openapi.yaml public/openapi.yaml
```

A future improvement is to sync this automatically in CI rather than manually.

## Deploy

Pushes to `main` trigger a Cloudflare Pages build. Preview deploys land on per-PR URLs.

## License

The thesis and prototype are MIT licensed. Same applies to this documentation site. See LICENSE in the [federation-core repo](https://github.com/JamilEssifiDEV/federation-core).
