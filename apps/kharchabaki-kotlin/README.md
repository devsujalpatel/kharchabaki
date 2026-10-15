# Kharchabaki for Android

A native Kotlin and Jetpack Compose implementation of `../kharchabaki-native`. This is a separate Android app, with no React Native, Expo, JavaScript engine, or WebView. The existing mobile app, web app, and API are unchanged.

## Build and run

Open this directory in Android Studio, let Gradle sync, and run the `app` configuration on an Android device or emulator.

Command-line requirements: Android SDK platform/build tools 36, JDK 17 or newer supported by Gradle 9.5.1, and a configured `ANDROID_HOME` (or an untracked `local.properties` with `sdk.dir=...`). The checked-in Gradle wrapper downloads its pinned, checksum-verified distribution.

```sh
cd apps/kharchabaki-kotlin
./gradlew :app:assembleDebug
./gradlew :app:installDebug
```

The debug APK is `app/build/outputs/apk/debug/app-debug.apk`. Android 8.0 / API 26 is the minimum supported version. The application ID is `com.kharchabaki.kotlin`, so it installs alongside the Expo app.

Choose **Continue offline** for a complete local workspace without a server or account. Set the available balance or add income before recording expenses or lending money.

## API and authentication

The default development origin is `http://10.0.2.2:4000`, which reaches the host machine from the standard Android emulator. Run the existing `services` API separately. Configure a different origin through a Gradle property, without an `/api/v1` suffix:

```sh
./gradlew :app:assembleDebug -PAPI_BASE_URL=https://your-api.example.com
```

You can also copy `.env.example` to `.env` in this directory and set `API_BASE_URL=https://your-api.example.com`. The build reads the URL in this order: Gradle property (`-PAPI_BASE_URL` or `gradle.properties`), shell environment, `.env`, then the emulator default. `.env` accepts a literal URL with optional single/double quotes and is ignored by Git. Rebuild the APK after changing the URL; the installed app does not read `.env` at runtime. Use HTTPS on a physical device and in production. HTTP is limited to emulator/loopback development addresses and permitted only by the debug manifest; release builds reject cleartext traffic.

The native Android HTTP client does not need a browser CORS allowlist entry. Keep the backend's existing browser origins and its separate Better Auth `kharchabaki://` trusted origin; the backend already has the latter configured.

Google sign-in uses the backend's existing Better Auth Expo browser bridge, including `expo-origin`, its authorization proxy, and the `kharchabaki://kotlin-auth` callback. The existing `kharchabaki://` trusted origin supports it. Configure the backend's Google provider and redirect URL as for the current mobile app. The callback requires a matching one-use nonce and expires after ten minutes. Email/password sign-in is also available for existing accounts enabled on the backend.

Cookies are stored using Android Keystore AES-GCM encryption. Identity, entitlement, and expiry restore before network verification. Offline accounts never expire; signed-in sessions permit offline access until their recorded expiry. A confirmed `401` signs out while retaining finance files. A `403` persists revoked Premium access and opens a separate device workspace. Entitlement comes from the server, with no client upgrade switch.

## Features

- Overview with current balance, UTC month selection, totals, and recent transactions.
- Income/expense creation, editing, deletion, dates, categories, and descriptions.
- Searchable history with month/all-history, type, and category filters.
- Six-month and daily income/expense charts and category breakdowns.
- Borrowed and lent loans, flat interest, due dates, editing, deletion, and repayments.
- Monthly category budgets and threshold indicators.
- Custom income sources and expense categories, including rename/archive.
- Daily, weekly, monthly, and yearly recurring entries with interval and end date.
- INR and other Java-supported currency formats, plus all six original themes.
- CSV import/export and full device-workspace JSON backup/restore.

Guest, free-account, and Premium workspaces are isolated. Free and guest changes stay on the device. Premium transactions, preferences, budgets, categories, and recurring rules use an ordered durable outbox and sync after reconnecting. Loans, repayments, balance replacement, and explicit cloud recurrence execution require a connection and completed prior sync. Client mutation IDs and stable record IDs support safe transaction replay after a lost response. Profile exposes pending errors and a confirmed **Discard pending changes** recovery action, which fetches canonical server data before atomically replacing all unsynced local changes. Recovery retains changes already accepted by the server and refuses to discard edits added during the fetch.

Local recurring entries run when opening/resuming the app or selecting **Run due**. This version does not schedule Android background alarms. Premium recurrence runs through the server. A rule that cannot be funded reports an error while preserving access to the rest of the cloud ledger. The current backend does not recalculate `nextRunAt` when changing an existing rule's start date, so that field is fixed for existing Premium rules; create a replacement rule to change its start date.

## Move existing mobile data

The Kotlin app cannot read the Expo app's private AsyncStorage. In the old app, open **Profile → Import & export** and export a JSON backup from a guest/free device workspace. In the Kotlin app's corresponding device workspace, select **Restore JSON backup**. The `kharchabaki-finance` version 1 format preserves the balance, transactions, loans/payments, budgets, recurring rules, custom categories, and preferences. Restore replaces that workspace after confirmation.

CSV files use the existing mobile columns (`type`, `amount`, `category`, `source`, `description`, `occurredAt`), with optional `id` and `createdAt` columns in Kotlin exports. Imports validate the complete file and commit atomically; repeating the same file skips matching IDs. An import requires enough available balance to cover its net expenses. Premium CSV imports join the sync queue. Full JSON export and restore are available only in device workspaces. File-picker imports are limited to 10 MB and bound to the account that opened the picker.

Premium cloud records download after sign-in to the same account; device-only changes remain separate and are never silently uploaded on upgrading an account.

## Performance and validation

The UI renders through Compose and Canvas with keyed lazy history rows. Currency formatters, filters, chart aggregates, and the current balance are reused. Preference changes render optimistically with latest-selection protection. Disk parsing, sorting, serialization, and network requests run off the main thread; storage commits atomically before publishing success. Release builds enable R8 optimization and resource shrinking:

```sh
./gradlew :app:testDebugUnitTest :app:lintDebug
./gradlew :app:assembleRelease -PAPI_BASE_URL=https://your-api.example.com
```

The release APK is unsigned until you configure your own signing key in Android Studio or Gradle. Never commit a signing key or credentials.

Unit tests exercise exact-cent arithmetic, validation, balance effects, loans, workspace isolation, stale actions, storage failures, recurrence idempotency/month-end dates, JSON/CSV migration, queue replay/projection, canonical budget IDs, atomic recovery, and backend response parsing. Google sign-in and a live Premium account still need integration testing against a configured backend.

Validated in this workspace: debug and optimized release APK builds, all 27 JVM tests, and full Android lint (zero errors; dependency/version update warnings remain). The release APK is approximately 1.6 MB before signing. The temporary software emulator did not start Android's package service, so UI launch checks and device performance measurements could not be completed here.

Storage currently uses one atomic JSON file per workspace. It avoids main-thread I/O and partial writes, but each mutation serializes that workspace. Very large histories should move to indexed Room tables before claiming large-scale write performance. No real-device speedup is claimed without release measurements. Compare startup, scrolling frame times, theme changes, and keyboard behavior on the same phone and dataset using Android Studio's profiler; emulator or debug-build timing is not representative.

The API exposes independent collection reads rather than an atomic versioned snapshot. Concurrent writes from another device may briefly skew a refresh's balance/history relationship until the next sync.
