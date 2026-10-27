#!/usr/bin/env bash
# Compiles the Android JS bundle once before any Maestro flow runs. The debug APK
# loads its JS from Metro at launch; the first request compiles the whole bundle
# (minutes on a CI runner), and a flow that launches the app during that window sees
# the "Unable to load script" redbox, so every flow in the shard then fails at the
# login assertion. Never fails the job: a missed warm-up only costs what it cost before.
# Usage (cwd=frontend/, Metro already listening on :8081): bash ../scripts/warm-metro-android.sh
set -u
manifest="$(curl -sf -m 60 -H 'expo-platform: android' http://localhost:8081/ || true)"
url="$(printf '%s' "$manifest" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{process.stdout.write(JSON.parse(s).launchAsset.url)}catch(e){}})" 2>/dev/null || true)"
if [ -z "$url" ]; then
  echo "::warning::warm-metro-android: no Android bundle URL in the manifest; skipping warm-up"
  exit 0
fi
# The manifest advertises the host's LAN address; the runner reaches Metro on localhost.
url="$(printf '%s' "$url" | sed -E 's#^(https?://)[^/]+#\1localhost:8081#')"
curl -sf -m 240 -o /dev/null -w 'warm-metro-android: bundle %{http_code}, %{size_download} bytes, %{time_total}s\n' "$url" || echo "::warning::warm-metro-android: bundle request failed or timed out; continuing without warm-up"
exit 0
