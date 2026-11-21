---
title: CI Android build fails with "Unsupported class file major version 69" (runner JDK 25)
date: 2026-11-19
category: docs/solutions/build-errors
module: ci
problem_type: build_error
component: tooling
symptoms:
  - "./gradlew assembleDebug fails in 5-12 s: BUG! exception in phase 'semantic analysis' in source unit '_BuildScript_' Unsupported class file major version 69"
root_cause: config_error
resolution_type: config_change
severity: high
tags: [ci, github-actions, gradle, jdk, android, setup-java]
---

# CI Android build fails with "Unsupported class file major version 69"

## Problem

Every `e2e-mobile-build` job ("Build debug APK") failed within seconds (runs 43962405755, 43945111421). Last green staging CI was 2026-11-14.

## Cause

No workflow set a JDK, so Gradle used the `ubuntu-latest` default, which moved to JDK 25 (class file major version 69). The Gradle/Groovy shipped with React Native 0.81 / Expo SDK 54 cannot read JDK 25 classes.

## Fix

Pin the JDK in the job: `actions/setup-java@v5.2.0`, `distribution: temurin`, `java-version: "17"` (the version the RN 0.81 and Expo SDK 54 docs require), plus a `java -version` log step. `scripts/__tests__/ci-workflow-jdk.test.js` fails if any workflow job running `./gradlew assemble|bundle|build` lacks a pinned JDK 17.

## Prevention

Never rely on a runner's default toolchain for Gradle builds. EAS builds run on Expo servers and are unaffected.
