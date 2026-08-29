---
title: "EAS Update (OTA) added so JS/UI fixes reach installed builds without manual reinstall"
date: 2026-08-16
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

OTA updates only reach installs that already contain the `expo-updates` runtime — **a build that predates this setup cannot receive OTA updates at all.** One more full APK install was required as the "base" build (the first build produced after this setup landed) specifically to adopt OTA; every install after that base build gets JS/UI fixes automatically on next app open. This is a one-time transition cost, not a recurring one.

OTA cannot deliver native changes: new native modules, permission changes, or an Expo SDK bump still require a fresh full APK build and manual reinstall, same as before. Don't claim OTA replaces full builds entirely — it only replaces them for the JS/UI-only case, which is most day-to-day fixes but not all of them.

## When to Apply

- Any fix that only touches JS/TS application code, styling, or non-native logic — let it ship via OTA, no manual reinstall needed on already-adopted devices
- A change that adds/updates a native module, changes native permissions, or bumps the Expo SDK version — still requires a full EAS build + manual reinstall
- A brand-new device installing the app for the first time — must install a full APK (any build produced after the OTA base build works; it already contains the `expo-updates` runtime)

## Examples

Before: every fix (however small) → trigger EAS build → wait for it to finish → share a fresh `.apk` link → every device manually reinstalls.

After (JS/UI fix): push to `master` → CI publishes an OTA update on the `preview` channel → devices already on a post-base-build install pick it up automatically next time they open the app, no link or reinstall needed.
