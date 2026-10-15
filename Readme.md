# Kharchabaki

Kharchabaki is a personal finance app for keeping everyday money matters in one place: income, expenses, balances, and money lent or borrowed.

The repository contains an Express API, a Next.js web app, an Expo mobile app, and a native Kotlin Android app.

## Project structure

```text
kharchabaki/
├── apps/
│   ├── kharchabaki-native/ # Expo mobile app
│   ├── kharchabaki-kotlin/ # Kotlin + Jetpack Compose Android app
│   └── web/                # Next.js web app
└── services/         # Express API
```

The Kotlin Android rewrite builds independently and installs alongside the Expo app. See [its README](apps/kharchabaki-kotlin/README.md) for setup, API configuration, data transfer, and release performance validation.

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

For the Vercel backend project, set **Root Directory** to `services`, configure the production `DATABASE_URL`, and use this **Build Command** to apply pending migrations only for production deployments:

```bash
if [ "$VERCEL_ENV" = "production" ]; then pnpm db:migrate; fi && pnpm build
```

For a one-time production repair, deploy the latest migration or run `pnpm db:migrate` from `services/` with the production `DATABASE_URL`. Migration `0012_repair_finance_label` restores the `finance_label` table and its indexes and foreign key if migration `0010` was recorded without the table being present. Do not run migrations from API startup or request handlers.

## Finance features

Both clients provide a six-month income/expense comparison, daily chart detail, month-by-month transaction history, and income/expense editing and deletion. Forms accept transaction dates for entering older records. History supports month, type, category, and search filters, with an all-history option.

Profile settings save the account's default currency and theme. Currency choices include INR (₹), USD ($), GBP (£), JPY (¥), EUR (€), and other supported currencies. Changing the currency changes formatting without converting stored amounts. Themes are Light, Dark, Ocean, Forest, Sunset, and Rose.

Before running the updated clients, apply the schema migration from `services/`:

```bash
pnpm db:migrate
```

The migration adds categories and account preferences while preserving existing transactions and legacy income source values.

Premium authenticated finance endpoints (under `/api/v1`):

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/summary?month=2026-10` | Current balance, selected-month totals, daily points, and six monthly buckets ending in the selected month. |
| `GET` | `/transactions?month=2026-10&type=expense&category=food&search=lunch` | Filtered history. Omit `month` to retrieve all history. |
| `GET`, `POST` | `/income`, `/expense` | List or create income/expenses. |
| `PATCH`, `DELETE` | `/income/:id`, `/expense/:id` | Edit or delete an owned transaction and adjust its balance contribution atomically. |
| `GET`, `PATCH` | `/preferences` | Retrieve or save `currency` and/or `theme`. |

Creation and edit requests accept `amount`, `source` (income) or `category` (expense), optional `description`, and optional `occurredAt` as an ISO UTC timestamp. Editing requires amount and source/category; an omitted date preserves the original date. Amounts must be positive with at most two decimal places. Month boundaries and chart dates use UTC. The balance card always shows the current account balance, including when viewing an older month.

## Device storage and Premium sync

Choose **Offline only** on the login screen to use the app without an account or connection. The guest workspace persists on the device and does not expire. Income, expenses, charts, opening balance, loans, repayments, currency, and themes all work locally. Returning to login or signing in preserves the guest workspace; it remains separate from signed-in accounts.

Signed-in free accounts also use device storage. `user.isPremium` defaults to `false`; cloud finance and preference APIs return `403` unless the authenticated database account is Premium. `/me` and sign-in remain available to every account. Clients cannot grant Premium through signup, profile updates, headers, or request bodies. There is no billing flow or user-facing Premium toggle; entitlement must be set by a trusted server/admin process.

Apply `services/drizzle/0009_premium_entitlement.sql` through the usual migration command before deploying these clients and API:

```bash
cd services
pnpm db:migrate
```

This adds the default-false flag to existing and new users. It does not delete server data. Existing cached finance data for the same account is copied into its first device workspace so local history remains usable. The original cloud snapshot and pending queue remain intact. Device and cloud workspaces stay separate; later device-only changes are not automatically uploaded when an account becomes Premium.

Web uses account-scoped IndexedDB; mobile uses AsyncStorage. Free and guest changes commit locally without a sync queue or finance API requests. Premium transaction and preference changes queue offline, update local history/charts, and replay in order after reconnecting. Premium loan changes and opening-balance replacement still require a connection and an empty pending queue. Browser tabs coordinate writes and syncing through Web Locks where available.

A server `403` stops further cloud requests and persists the revoked entitlement. A valid signed-in session permits offline access until its recorded expiry; confirmed `401` responses or known expiry send users to login while retaining saved data. Guest mode makes no auth-session requests. Session snapshots contain identity, entitlement, and expiry without authentication tokens; native authentication cookies use SecureStore.

Native startup restores device data before waiting for network verification. Theme choices apply immediately, remain selectable during saves, and preserve the latest choice if older requests finish later. Preferences and currency formatters are memoized, and transaction history uses a virtualized `SectionList` with memoized rows. Hardware frame-rate and keyboard testing should use a release build.

The production web service worker caches visited app pages and assets, excluding API responses and session tokens. Run `pnpm build` followed by `pnpm start` in `apps/web` to test offline reopening. Native builds need AsyncStorage and Expo Crypto modules (`pnpm android` or `pnpm ios` in `apps/kharchabaki-native`).

Run `pnpm test:offline` from `services/` for guest persistence, free/Premium isolation, local finance validation, queued sync, response loss, storage failures, concurrent tabs, revocation, and expiry. `pnpm test` covers finance APIs and Premium authorization, including blocked client entitlement changes.
