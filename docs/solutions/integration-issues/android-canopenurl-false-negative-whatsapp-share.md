---
title: "Linking.canOpenURL gives false 'WhatsApp not installed' on Android 11+"
category: integration-issues
issue: 144
---

## Symptom
Add Member modal showed "WhatsApp is not installed on this device" on phones that have WhatsApp.

## Cause
`Linking.canOpenURL('whatsapp://...')` returns false on Android 11+ for apps not declared in the manifest `<queries>` (package visibility), even when installed. The Share button also sat under the growing members list, so layout shift caused accidental taps.

## Fix / rule
Never gate an external-app share on `canOpenURL`. Call `Linking.openURL` directly, fall back to `https://wa.me/?text=...`, and only if both reject show a friendly localized message. Keep sharing out of the member-add path and outside the scrolling list (fixed footer). A native `<queries>` entry is optional and needs a new build.

## Regression
`frontend/src/__tests__/regression/issue-144-whatsapp-share-non-blocking.test.tsx`
