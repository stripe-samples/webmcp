# Check out a Stripe page with WebMCP + Stagehand

Opens a Stripe Checkout page, drives it through its WebMCP tools
(`select_payment_method`, `fill_payment_form`), clicks the pay button with
Stagehand, and prints the order from `get_order_summary`. Stripe exposes no
"pay" tool, so the click is the only step that is not WebMCP.

## Requirements

- Node.js 24 and pnpm 10.32.1.
- Google Chrome with WebMCP support (tested with Chrome 153). Stagehand enables the browser flags.
- A Stripe Checkout URL (a payment link, or a page embedding Stripe Elements).

## Run

```sh
pnpm install
cp .env.example .env
```

Fill in `.env`, then:

```sh
pnpm start
```

`CONFIRM_PURCHASE=yes` is required. The run aborts if the total exceeds
`MAX_TOTAL_MINOR` (minor units, so `900` is $9.00).

`KEEP_OPEN=yes` leaves the browser up after paying.

## Notes on the WebMCP tools

- Field names differ per session: sessions that collect shipping expose
  `shipping*`, others expose `billing*`. Anything missing from the current
  schema is skipped.
- `fill_payment_form` often re-renders and never acks. The script fills one
  field per call and continues on a missing ack.

## Development

```sh
pnpm lint
pnpm typecheck
```

Run `pnpm format` to apply formatting and lint fixes.
