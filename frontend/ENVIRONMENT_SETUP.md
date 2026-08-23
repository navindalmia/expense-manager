# Frontend Environment Setup

## Environment Loading Order

Expo (SDK 49+, this project is on 54) natively loads dotenv files per mode, highest precedence first:

1. `.env.development.local` — personal override, gitignored
2. `.env.local` — personal override, gitignored, applies to every mode
3. `.env.development` — **committed shared default**, this is the one checked into the repo
4. `.env` — committed base fallback (not currently used in this repo)

`NODE_ENV` defaults to `development` for `expo start`, `expo run:android`, `expo run:ios`, and `expo prebuild` — so `.env.development` is what a plain local dev run, a Maestro-driven local emulator build, and (once wired) CI's `e2e-mobile` job all pick up automatically, with no manual export needed.

## For New Machines (After Cloning)

Nothing to do for Android emulator or CI use — `.env.development` already ships a working default:

```
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:4000/api
```

`10.0.2.2` is the Android emulator's fixed alias for the host machine's `localhost` — not a real network address, so this value works on any machine unmodified.

## For Physical Device Testing

A physical phone can't reach `10.0.2.2` or `localhost` on your dev machine — it needs your machine's real LAN IP. Create a personal override (gitignored, never committed):

```bash
cp .env.example .env.development.local
# then edit EXPO_PUBLIC_API_BASE_URL to http://<your-LAN-IP>:4000/api
# find your LAN IP: `ipconfig getifaddr en0` (Mac Wi-Fi) or `ipconfig` (Windows)
```

## Production / Preview Builds

EAS build profiles inject the URL directly — see `eas.json`'s `build.preview.env.EXPO_PUBLIC_API_BASE_URL`. No local `.env` file is involved in an EAS-built binary.

## Why This Matters (lesson, 2026-08-22/23)

A stray personal `.env` file with a LAN IP value was silently baked into Maestro test builds, with no committed default to fall back to and no clear precedence documented — the app couldn't tell whether it was building for "my phone" or "the emulator/CI." `.env.development` fixes this at the source: there's now always a correct, committed, environment-appropriate default, and personal overrides are opt-in and clearly scoped to `.local` files that never should be, and structurally can't be, committed.

## Security Rules

✅ **DO:**
- Keep personal overrides in `.env.development.local` or `.env.local` (already gitignored)
- Use `.env.example` as the template for what variables exist
- Store production secrets (if any are ever added here) in the deployment platform / EAS secrets, not a file

❌ **DON'T:**
- Commit `.env.development.local` or `.env.local`
- Put a personal LAN IP or any secret in `.env.development` — it's committed and shared
