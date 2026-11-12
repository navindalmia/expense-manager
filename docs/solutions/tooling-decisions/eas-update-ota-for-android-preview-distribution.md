---
title: "EAS Update (OTA) added so JS/UI fixes reach installed builds without manual reinstall"
date: 2026-08-16
last_updated: 2026-10-24
category: docs/solutions/tooling-decisions
module: frontend (Expo), .github/workflows/eas-build.yml
problem_type: tooling_decision
component: tooling
applies_when:
  - "Distributing fixes to Android devices that installed the app via a direct EAS-built APK (no Play Store, internal distribution)"
  - "The change being shipped is JS/UI-only, not a native module, permission, or SDK change"
tags: [eas-update, ota, expo-updates, android, internal-distribution, ci]
---

# EAS Update (OTA) added so JS/UI fixes reach installed builds without manual reinstall

## Context

This project distributes Android builds via EAS internal-distribution APKs (see `docs/solutions/build-errors/render-eas-free-tier-deploy-setup.md` for the original Render+Neon+EAS setup) — there is no Play Store listing, so there was also no auto-update mechanism. Every fix, however small, required manually re-downloading and reinstalling a fresh APK on every device that had the app installed. This was noticeable friction during active bug-fixing: two fixes shipped the same day (the Render cold-start timeout and the signup dead-end, see their respective docs) each required a fresh manual install to reach a test device.

## Guidance

Added `expo-updates` and EAS Update so JS/UI-only changes can be pushed over-the-air (OTA) to already-installed app instances, without requiring a fresh APK download/install each time:

- `expo-updates` installed via `npx expo install expo-updates` (resolves the SDK-54-compatible version, not plain `npm install`)
- `app.json`: added `updates` config and `runtimeVersion: { policy: "appVersion" }` — Expo's own CLI default for a project without custom native code beyond standard Expo modules (chosen over `"fingerprint"` for that reason)
- `frontend/eas.json`: added a `channel` to each build profile so a build knows which update channel to check against; the `preview` channel/branch was created on EAS (didn't exist before)
- `.github/workflows/eas-build.yml`: on a qualifying push, CI now runs `eas update --branch preview --channel preview --non-interactive` (in addition to the existing full-build trigger), gated behind the same `tsc`+test checks as the build step

```yaml
# .github/workflows/eas-build.yml (excerpt)
- name: Publish OTA update (preview channel)
  env:
    UPDATE_MESSAGE: ${{ github.event.head_commit.message }}
  run: npx eas-cli update --branch preview --non-interactive --message "$UPDATE_MESSAGE"
```

Two CI bugs were hit and fixed while wiring this up:
1. `eas-cli update` rejects passing both `--channel` and `--branch` together once they're already paired 1:1 — `--branch` alone is sufficient.
2. Interpolating `${{ github.event.head_commit.message }}` directly into the shell command breaks on any multiline commit body — pass it through an env var (`$UPDATE_MESSAGE`, quoted) instead.

## Why This Matters

OTA updates only reach installs that already contain the `expo-updates` runtime — **a build that predates this setup cannot receive OTA updates at all.** One more full APK install was required as the "base" build (the first build produced after this setup landed) specifically to adopt OTA; every install after that base build can receive JS/UI fixes over the air, but not instantly: by default the app downloads the update in the background at launch and applies it on a LATER launch (see "Staging channel, launch wait and the Free-plan build cap" below). This is a one-time transition cost, not a recurring one.

OTA cannot deliver native changes: new native modules, permission changes, or an Expo SDK bump still require a fresh full APK build and manual reinstall, same as before. Don't claim OTA replaces full builds entirely — it only replaces them for the JS/UI-only case, which is most day-to-day fixes but not all of them.

## When to Apply

- Any fix that only touches JS/TS application code, styling, or non-native logic — let it ship via OTA, no manual reinstall needed on already-adopted devices
- A change that adds/updates a native module, changes native permissions, or bumps the Expo SDK version — still requires a full EAS build + manual reinstall
- A brand-new device installing the app for the first time — must install a full APK (any build produced after the OTA base build works; it already contains the `expo-updates` runtime)

## Examples

Before: every fix (however small) → trigger EAS build → wait for it to finish → share a fresh `.apk` link → every device manually reinstalls.

After (JS/UI fix): push to `master` → CI publishes an OTA update on the `preview` channel → devices already on a post-base-build install download it at the next launch and apply it on the launch after that, no link or reinstall needed (staging builds can be made to apply it on the same launch, below).

## Staging channel, launch wait and the Free-plan build cap (added 2026-10-24)

What happened: on 2026-10-24 the owner's staging phone stayed on "Embedded build" (About screen) although updates were being published, and a later change could not be built at all because the Expo Free plan's monthly Android build allowance was used up (`This account has used its Android builds from the Free plan this month`, reset 2026-11-01; per the `eas build` error text). JS-only fixes still reached the phone as over-the-air updates, which is what made the cap survivable.

- **Verify the server side before suspecting the phone.** The staging channel maps to the `staging` update branch, and the update server can be asked directly what it would serve to a given build: `curl -H 'expo-protocol-version: 1' -H 'expo-platform: android' -H 'expo-runtime-version: 1.0.0' -H 'expo-channel-name: staging' -H 'accept: multipart/mixed' https://u.expo.dev/<projectId>` returns a manifest with the update id and runtimeVersion. A build's `updateChannel` and `runtime.version` are in `eas build:view <id> --json`. When all three match, the gap is client behavior, not publishing.
- **Default client behavior is download now, apply later.** With `checkAutomatically` ON_LOAD and `fallbackToCacheTimeout` 0 the app fetches in the background and uses the new update only on the next launch (Expo's `expo-updates` docs). For internal staging testers this reads as "updates never arrive".
- **Staging-only fix (#137):** the staging variant sets `updates: { ...baseConfig.updates, checkAutomatically: 'ON_LOAD', fallbackToCacheTimeout: 5000 }` (`frontend/app.config.js:89`) so launch waits up to 5s for an update and applies it on the same launch; production keeps the default. About also has a staging-only **Check for update** button (`runUpdateCheck`, `frontend/src/components/UpdateCheck.tsx:19-34`) that calls `checkForUpdateAsync`, `fetchUpdateAsync`, `reloadAsync` and shows the real error text, so a tester can see why a phone is not updating. These are native/config changes: they only take effect on a build installed after #137 (the first such staging APK was build 29881183 per this session).
- **The staging workflow builds an APK only when native or config files changed** (`.github/workflows/eas-staging.yml`, job `detect-native-changes`, lines 77-101) and always publishes the update (`eas update --branch staging`, line 75). Remember that CI-started builds also draw from the same monthly allowance; batch native changes and prefer OTA for UI/logic.
- **Do not tell testers "it will update by itself".** Give the install link for native changes and say "About -> Check for update" for JS changes.

