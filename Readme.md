# Kharchabaki

Kharchabaki is a personal finance app for keeping everyday money matters in one place: income, expenses, balances, and money lent or borrowed.

This repository is in its early stages. It currently contains the TypeScript/Express API foundation; the web and mobile clients are reserved for future work.

## Project structure

```text
kharchabaki/
├── apps/
│   ├── mobile/       # Future mobile client
│   └── web/          # Future web client
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
| `pnpm db:generate` | Generate Drizzle migration files. |
| `pnpm db:migrate` | Apply Drizzle migrations. |
| `pnpm db:push` | Push the schema to the configured database. |

## Status

The API currently provides its base middleware, versioned routing, health check, error handling, and graceful shutdown. Finance features and client applications are still to come.
