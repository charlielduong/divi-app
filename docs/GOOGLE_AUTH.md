# Google Authentication with Expo and Supabase

## End-to-end flow

```text
Expo app
  → Supabase OAuth request
  → Google account login
  → Google redirects to Supabase
  → Supabase creates a session
  → Supabase redirects back to Expo
  → Expo stores and uses the session
```

1. The user taps Google sign-in. The app calls `supabase.auth.signInWithOAuth()` with Google and an app redirect URL.
2. Supabase opens Google’s authorization page.
3. Google authenticates the user and redirects to the configured Supabase Auth callback URL. For the local simulator stack this is `http://127.0.0.1:54321/auth/v1/callback`; for a phone or deployed environment it must be a reachable HTTPS URL such as `https://api-staging.example.com/auth/v1/callback`.
4. Supabase verifies the Google response, creates or finds the user, and creates an access/refresh-token session.
5. Supabase redirects to the app. The Supabase client reads the response and persists the session.
6. The app listens for auth changes and renders the authenticated or signed-out experience.

## Configuration

There are two different redirect destinations:

- **Google → Supabase:** configure the Supabase callback URL in the Google Cloud OAuth client.
- **Supabase → Expo:** add the app redirect URL to Supabase’s allowed redirect URLs. The native app uses `divi://auth/callback`; the web build may use its current browser origin.

For local development, `127.0.0.1` works from the iOS Simulator because the simulator shares the Mac's development context. A physical iPhone cannot reach the Mac through `127.0.0.1`. Metro uses LAN mode for the JavaScript bundle, while the current API/Auth path uses an ngrok HTTPS tunnel:

```text
Google / iPhone → https://<ngrok-host> → Mac:54321 → local Supabase
```

Start the local stack and tunnel with `npm run start` from `divi_backend` and `ngrok http 54321`. Put the resulting values in the ignored `divi_backend/supabase/.env` as `SUPABASE_AUTH_EXTERNAL_URL=https://<ngrok-host>` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_REDIRECT_URI=https://<ngrok-host>/auth/v1/callback`. Use the same HTTPS hostname as the client's `EXPO_PUBLIC_SUPABASE_URL`, and register the callback in Google Cloud. The tracked `config.toml` reads these values through `env(...)`. The free ngrok hostname is not guaranteed to persist across restarts; use a stable staging hostname before production.

In the local CLI project, configure the Google provider in `divi_backend/supabase/config.toml` and keep the client ID and secret in the ignored `divi_backend/supabase/.env`. In a deployed self-hosted environment, configure the equivalent Auth environment variables on the server. In Google Cloud, configure the OAuth consent screen and a separate web OAuth client for each environment.

## Environment variables

The Expo app uses:

```env
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

The URL identifies the Supabase project. The publishable key is intended for client apps and is not a password. Never put the Supabase service-role key in Expo code; it bypasses security controls and belongs only on a trusted server.

## Sessions and users

The Supabase client persists the session locally and refreshes tokens when needed. Use `supabase.auth.getSession()` for the current session and `supabase.auth.onAuthStateChange()` for events such as `SIGNED_IN`, `SIGNED_OUT`, and `TOKEN_REFRESHED`.

The authenticated user is available at `session.user`. Useful fields include `email`, `user_metadata.full_name`, and `user_metadata.avatar_url`. Users can be viewed in Supabase under **Authentication → Users**.

Sign out with:

```ts
await supabase.auth.signOut();
```

## Database security

Google verifies the user’s identity; Supabase represents it with `auth.users.id`. Protect application tables with Row Level Security policies, commonly matching a row’s `user_id` to `auth.uid()`. The publishable key is safe to ship only when RLS policies correctly restrict access.
