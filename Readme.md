# Kharchabaki

Kharchabaki is a personal finance app for keeping everyday money matters in one place: income, expenses, balances, and money lent or borrowed.

The repository contains an Express API, a Next.js web app, and an Expo mobile app.

## Project structure

```text
kharchabaki/
├── apps/
│   ├── kharchabaki-native/ # Expo mobile app
│   └── web/                # Next.js web app
└── services/         # Express API
```

## API quick start

### Prerequisites

- Node.js 22 or later
- pnpm 12 or later

### Run locally

```bash
cd services
pnpm install
pnpm dev
```

The API starts at `http://localhost:4000` by default.

### Configuration

The service reads environment variables from `services/.env` when present.

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `4000` | HTTP port for the API (must be an integer from 1 to 65535). |
| `NODE_ENV` | `development` | Runtime environment label. |

Example `services/.env`:

```env
PORT=4000
NODE_ENV=development
```

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | Confirms that the API is running. |
| `GET` | `/api/v1/health` | Returns the service health status and a timestamp. |

For example:

```bash
curl http://localhost:4000/api/v1/health
```

Successful API responses use this shape:

```json
{
  "success": true,
  "message": "Service is healthy",
  "data": {}
}
```

## Useful commands

Run these inside `services/`:

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the API in watch mode. |
| `pnpm typecheck` | Check TypeScript without emitting files. |
| `pnpm test` | Build and run finance service tests with a mocked database transport. |
| `pnpm db:generate` | Generate Drizzle migration files. |
| `pnpm db:migrate` | Apply Drizzle migrations. |
| `pnpm db:push` | Push the schema to the configured database. |

## Finance features

Both clients provide a six-month income/expense comparison, daily chart detail, month-by-month transaction history, and income/expense editing and deletion. Forms accept transaction dates for entering older records. History supports month, type, category, and search filters, with an all-history option.

Profile settings save the account's default currency and theme. Currency choices include INR (₹), USD ($), GBP (£), JPY (¥), EUR (€), and other supported currencies. Changing the currency changes formatting without converting stored amounts. Themes are Light, Dark, Ocean, Forest, Sunset, and Rose.

Before running the updated clients, apply the schema migration from `services/`:

```bash
pnpm db:migrate
```

The migration adds categories and account preferences while preserving existing transactions and legacy income source values.

Authenticated finance endpoints (under `/api/v1`):

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/summary?month=2026-10` | Current balance, selected-month totals, daily points, and six monthly buckets ending in the selected month. |
| `GET` | `/transactions?month=2026-10&type=expense&category=food&search=lunch` | Filtered history. Omit `month` to retrieve all history. |
| `GET`, `POST` | `/income`, `/expense` | List or create income/expenses. |
| `PATCH`, `DELETE` | `/income/:id`, `/expense/:id` | Edit or delete an owned transaction and adjust its balance contribution atomically. |
| `GET`, `PATCH` | `/preferences` | Retrieve or save `currency` and/or `theme`. |

Creation and edit requests accept `amount`, `source` (income) or `category` (expense), optional `description`, and optional `occurredAt` as an ISO UTC timestamp. Editing requires amount and source/category; an omitted date preserves the original date. Amounts must be positive with at most two decimal places. Month boundaries and chart dates use UTC. The balance card always shows the current account balance, including when viewing an older month.

## Offline use

After installing dependencies, rebuild the mobile development app with `pnpm android` or `pnpm ios` in `apps/kharchabaki-native`; AsyncStorage and Expo Crypto need native modules in the build.

Web stores account-scoped finance snapshots and pending changes in IndexedDB; mobile uses AsyncStorage. Income and expense creation, editing, deletion, and preference changes work offline, update local history and charts, and sync in order after reconnection or returning to the app. A sync indicator shows pending changes and server rejections, with retry, correction through the transaction editor, and discard controls. Browser tabs coordinate writes and syncing through Web Locks where available.

Connect once while signed in to save your history, summaries, settings, and loans on a device. Cached complete history supports browsing other months offline. Loan creation/payments and opening-balance replacement require a connection and an empty pending queue. The web service worker caches the visited app shell and assets in production; run `pnpm build` followed by `pnpm start` in `apps/web` to test offline reopening. API responses and session tokens are excluded from the service-worker cache.

A valid saved session permits offline access until its recorded expiry. Confirmed API 401 responses and known session expiry send users to login. An outage preserves valid offline access, and signing in again with the same account restores its unsynced work. Session snapshots store user identity and expiry, without authentication tokens. Native authentication cookies continue to use SecureStore.

Offline transaction creation uses a client UUID. The API recognizes a retry of an existing owned UUID and avoids charging or crediting the balance twice if a response was lost. Deploy the updated API together with the clients.

Run the persistence and session checks from `services/` with `pnpm test:offline`. These exercise offline restarts, local edits/deletion, synchronization, lost responses, storage failures, account isolation, concurrent browser tabs, and session expiry; `pnpm test` covers API balance and retry behavior.
