# Discover WebMCP tools with Stagehand

Open a Stripe page and print its WebMCP tool names and descriptions as JSON.

## Requirements

- Node.js 24 and pnpm 10.32.1.
- Google Chrome with WebMCP support (tested with Chrome 153). Stagehand enables the browser flags.
- A Stripe URL or one that embeds Stripe Elements

## Run

```sh
pnpm install
cp .env.example .env.local
```

```dotenv
STRIPE_URL="https://buy.stripe.com/..."
```

Then run:

```sh
pnpm start
```

## Development

```sh
pnpm lint
pnpm typecheck
```

Run `pnpm format` to apply formatting and lint fixes.
