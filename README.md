# Divi

Divi is a receipt-first bill-splitting app built with React Native, Expo, and TypeScript. The client uses Supabase Auth and a local Supabase/Postgres stack for authenticated Divi data, while receipt OCR remains on-device.

## Project structure

- `divi_client/` — Expo React Native app, client services, assets, tests, and client environment variables.
- `divi_backend/` — local Supabase CLI project, migrations, seed data, and backend environment variables.
- `docs/` — product, architecture, design, and flow documentation.

## Run locally

Requirements: Node.js 22.13 or newer and npm.

```sh
cd divi_client
npm install
npm run ios
```

Receipt OCR uses Apple Vision on iOS and Google ML Kit on Android. It runs entirely on-device and therefore requires a native development build; stock Expo Go cannot load the OCR module.

Build and run the app in the iOS Simulator or Android emulator:

```sh
cd divi_client
npm run ios
npm run android
```

## Local Supabase

This project includes the Supabase CLI configuration for a Docker-backed local stack. Make sure
Docker Desktop is running, then start Supabase with:

```sh
cd divi_backend
npm run start
```

The local API is available at `http://127.0.0.1:54321`, Studio at
`http://127.0.0.1:54323`, and Postgres at `127.0.0.1:54322`. The CLI applies migrations from
`divi_backend/supabase/migrations` and seed data from `divi_backend/supabase/seed.sql`.

After the first start, copy the generated publishable key into `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local-key-from-supabase-start>
```

The client environment file belongs at `divi_client/.env`.

### Local networking

There are two different local network paths:

- **iOS Simulator:** `127.0.0.1` points to the Mac, so the loopback URL in `divi_client/.env.example` works.
- **Physical iPhone:** `127.0.0.1` points to the iPhone itself. Set `EXPO_PUBLIC_SUPABASE_URL` to the Mac's Wi-Fi address instead, for example `http://192.168.1.25:54321`, and keep the phone and Mac on the same network. Start Metro with `npx expo start --dev-client --lan`.

The iOS development build declares the local-network usage description and Expo Bonjour service in `divi_client/app.json`. Rebuild the native app after changing that file with `npm run ios:device`; toggling **Settings → Divi → Local Network** alone does not change the native binary.

For physical-device and production Google sign-in, use the hosted Supabase project URL in the client environment and configure the hosted Supabase Auth callback in Google Cloud. The native callback remains `divi://auth/callback`.

The local Supabase stack is intended for simulator/browser development. Its local Google callback is `http://127.0.0.1:54321/auth/v1/callback`; a physical device should use the hosted Supabase environment instead of the local stack for Google sign-in.

The local backend keeps the database, API, Studio, and Auth enabled. Analytics,
Realtime, Storage, local SMTP, and Edge Runtime remain disabled in
`divi_backend/supabase/config.toml` until the app needs them.

Use `npm run stop` to stop the containers, `npm run status` to inspect them, and `npm run reset` to
recreate the database from migrations and seed data. Run these commands from `divi_backend`.

### Google sign-in

Google sign-in is implemented through Supabase Auth and the Expo `divi://auth/callback` deep link.
To enable it locally:

1. Create a Google OAuth **Web application** client in Google Cloud.
2. For the hosted environment, add `https://<project-ref>.supabase.co/auth/v1/callback` as an authorized redirect URI and enable Google in the Supabase Dashboard.
3. For local simulator testing, add `http://127.0.0.1:54321/auth/v1/callback`, copy `divi_backend/supabase/.env.example` to `divi_backend/supabase/.env`, and add the Google client ID and secret.
4. For local testing, set `enabled = true` in `[auth.external.google]` in `divi_backend/supabase/config.toml`.
5. Restart Supabase from `divi_backend` with `npm run stop && npm run start` when using the local stack.
6. Rebuild the native app after changing the Expo scheme or native dependencies:

```sh
npm run ios
```

Google OAuth configuration for self-hosted Supabase is handled in the local configuration rather
than the hosted Dashboard. The app's sign-in button opens the provider in a browser and exchanges
the returned session through the configured deep link.

Choose **Continue with Google** on the welcome screen.


To test the complete camera-to-claim flow with a real receipt on a connected iPhone, enable Developer Mode on the phone, connect it to the Mac, and run:

```sh
cd divi_client
npm run ios:device
```

Choose **Try local demo**, tap the center **Create Divi** action, then take a receipt photo. The app asks you to confirm the image, performs OCR locally, and opens every detected value for correction before claiming starts. The web build remains available with `npm run web`, but OCR falls back to manual entry there.

## Debug receipt OCR on an iPhone

Use the installed **Divi development app**, not Expo Go. Keep the iPhone and Mac on the same Wi-Fi.

### Rebuild after adding native modules

The onboarding gradient uses `expo-linear-gradient`. If an existing development app shows `Unimplemented Component: <ViewManagerAdapter_ExpoLinearGradient>`, the JavaScript bundle is newer than the installed native binary. Rebuild the development app once from `divi_client`:

```sh
npm run ios:device
```

Until that rebuild, the onboarding screen uses a solid Divi-green fallback on native while retaining the gradient on web.

1. Open this project folder in VS Code.
2. In the project folder, start Metro with the development-client option:

   ```sh
   cd divi_client
   npx expo start --dev-client --lan
   ```

   Leave the terminal running. If port `8081` is already in use, use the existing Expo terminal or stop that server with **Ctrl+C** before starting another.
3. Open **Divi** on your iPhone. If it does not connect to Metro, scan the terminal’s QR code with the iPhone Camera and open the link in Divi.
4. In VS Code, open `divi_client/src/services/receiptParser.ts`. Click the gutter beside line 99 to set a breakpoint inside `firstMerchantLine()`. When it pauses, inspect `lines` and `candidate`; use **Continue** to step through the candidates.
5. In Divi, tap **Create Divi**, take or choose a receipt, confirm the photo, and tap **Scan receipt**.

To inspect the raw OCR text before parsing, set another breakpoint in `divi_client/src/screens/CreateDiviScreen.tsx` on the `recognizeText(...)` call, then inspect `result.text`. From the Metro terminal, press **j** to open React Native DevTools if VS Code does not pause at the breakpoint. If `result.text` is correct but the selected title or items are wrong, trace `parseReceiptText()` in `divi_client/src/services/receiptParser.ts`.

## What is ready to review

- Acorns-inspired green, white, and black visual language
- Five-tab navigation with an elevated **Create Divi** action
- Camera and photo-library receipt capture with an image confirmation step
- On-device receipt OCR using Apple Vision (iOS) and Google ML Kit (Android)
- Editable OCR results with manual fallback and total reconciliation
- Editable claim flow with shared items
- QR invitation display
- Deterministic proportional allocation of tax, tip, fees, and discounts
- Final balances and explicit paid state
- Best-effort Venmo request handoff with copyable fallback details
- Activity, receipt history, and profile surfaces

## Verify the project

```sh
cd divi_client
npm run typecheck
npm test
npm run export:web
```

## Current integration boundaries

- Authentication uses Supabase Auth with Google sign-in.
- Receipt OCR runs locally; selected images are not uploaded.
- Receipt parsing is heuristic and always requires user review because store layouts vary.
- Storage is in memory and resets when the app reloads.
- Venmo uses a best-effort URL handoff. Opening Venmo marks a request as initiated, not paid.
- Production credentials, native App Clip support, and deployment are intentionally outside this local walkthrough. A production deployment should use a separate HTTPS Supabase host and environment rather than exposing the local CLI stack.

See `docs/` for product, flow, architecture, design, acceptance, and open-question specifications.

### Remove the retired merchant-photo integration

The app no longer requests merchant photos from Google Places. If the function was
previously deployed, remove it and its server-side key from the hosted Supabase
project from `divi_backend`:

```sh
npx supabase functions delete merchant-photo-lookup --project-ref <project-ref>
npx supabase secrets unset GOOGLE_PLACES_API_KEY --project-ref <project-ref>
npx supabase db push --project-ref <project-ref>
```

Also remove `GOOGLE_PLACES_API_KEY` from `divi_backend/supabase/.env` if you added it
for local Edge Function development.

The database migration drops the Place ID and photo-lookup state columns. Receipt
address extraction/storage remains independent of Places, so the receipt-analysis
Lambda does not need to be redeployed for this removal.
