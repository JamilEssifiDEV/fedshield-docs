// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// FedShield developer portal configuration.
// Accent: electric blue #3B82F6 (locked in /plan, 2026-06-07)
export default defineConfig({
  site: 'https://fedshield-docs.pages.dev',
  integrations: [
    starlight({
      title: 'FedShield',
      description:
        'Federated trust infrastructure for online multiplayer games. ' +
        'Cross-studio reputation signals without a central authority.',
      // Logo is omitted intentionally; the title text serves as wordmark.
      // Add src/assets/logo.svg + a logo: { src: '...' } block once we have one.
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/JamilEssifiDEV/federation-core',
        },
      ],
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'Welcome', slug: 'index' },
            { label: 'Quickstart (5 minutes)', slug: 'quickstart' },
          ],
        },
        {
          label: 'Concepts',
          items: [
            { label: 'How FedShield works', slug: 'concepts/overview' },
            { label: 'Peers and federation groups', slug: 'concepts/peers' },
            { label: 'Trust events', slug: 'concepts/events' },
            { label: 'Trust scores and verdicts', slug: 'concepts/scores' },
            { label: 'Peer-weighting and Sybil defence', slug: 'concepts/peer-weighting' },
          ],
        },
        {
          label: 'API',
          items: [
            { label: 'API reference', slug: 'api/reference' },
            { label: 'Authentication', slug: 'api/auth' },
            { label: 'Errors', slug: 'api/errors' },
          ],
        },
        {
          label: 'Code examples',
          items: [
            { label: 'Go', slug: 'examples/go' },
            { label: 'Node.js / TypeScript', slug: 'examples/node' },
            { label: 'C# / .NET', slug: 'examples/csharp' },
          ],
        },
        {
          label: 'Self-host',
          items: [
            { label: 'Run with Docker', slug: 'self-host/docker' },
            { label: 'Configuration reference', slug: 'self-host/config' },
          ],
        },
      ],
    }),
  ],
});
