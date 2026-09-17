# V3.7.7 Monitor Release APK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the validated Monitor/Overlay refactor as ETF財務管家 V3.7.7 and produce a signed Android ARM64 APK artifact from the isolated `gogo-monitor-refactor-20260917` branch.

**Architecture:** Preserve the already-green monitor refactor unchanged, bump only the release identity chain, then build from the same branch through GitHub Actions using the existing EAS-managed signing model. The release workflow verifies monitor contracts, TypeScript, exact version metadata, APK signing/package metadata, SHA256, and uploads the APK plus verification files as one artifact.

**Tech Stack:** Expo SDK 57, React Native 0.86.3, TypeScript, Android Gradle, EAS local build, GitHub Actions.

**Spec:** Current validated monitor refactor on `gogo-monitor-refactor-20260917` plus the user's GOGO instruction to finish and generate an APK.

## Global Constraints

- Work only on `gogo-monitor-refactor-20260917`; do not modify `main` during build preparation.
- Release identity is V3.7.7 with Android `versionCode 45`.
- Android package remains `com.etfpilot.twselive`.
- Preview profile must produce an APK, not an AAB.
- Monitor contracts and TypeScript must pass before APK build.
- APK must be signed, non-empty, report V3.7.7 / versionCode 45, and have SHA256 recorded.
- Do not dispatch Codex or other subagents.

---

### Task 1: Lock the V3.7.7 release identity

**Files:**
- Modify: `src/v3/version.ts`
- Modify: `app.json`
- Modify: `android/app/build.gradle`
- Modify: `android/app/src/main/res/values/strings.xml`

**Interfaces:**
- Consumes: Existing V3.7.6 release metadata.
- Produces: One consistent V3.7.7 / build 45 metadata chain for JS, Expo, OTA runtime and Android native packaging.

- [ ] **Step 1:** Change `APP_SEMVER` to `3.7.7` and `APP_BUILD` to `45`.
- [ ] **Step 2:** Change Expo name/version/runtimeVersion and Android/iOS build numbers to `3.7.7` / `45`.
- [ ] **Step 3:** Change Android Gradle `versionName` to `3.7.7` and `versionCode` to `45`.
- [ ] **Step 4:** Change native app label/runtime strings to V3.7.7.
- [ ] **Step 5:** Verify all four files agree exactly.

### Task 2: Add branch-specific signed APK release workflow

**Files:**
- Create: `.github/workflows/build-monitor-v377-apk.yml`

**Interfaces:**
- Consumes: `EXPO_TOKEN`, EAS preview profile, current monitor contracts, Android SDK/JDK 17.
- Produces: `ETF-Finance-Manager-V3.7.7-Monitor-Refactor-ARM64.apk` plus signing, badging, build-info and SHA256 files.

- [ ] **Step 1:** Checkout `gogo-monitor-refactor-20260917` explicitly.
- [ ] **Step 2:** Install Node 22.23.2, JDK 17 and npm dependencies.
- [ ] **Step 3:** Verify Expo/EAS authentication and V3.7.7 metadata chain.
- [ ] **Step 4:** Run `node scripts/MONITOR_V377_REFACTOR_CONTRACT.cjs`, `npm run typecheck`, and `git diff --check`.
- [ ] **Step 5:** Limit native build architecture to `arm64-v8a` on the runner only.
- [ ] **Step 6:** Run local EAS preview build with frozen EAS credentials to the fixed APK output path.
- [ ] **Step 7:** Verify APK signature, package id, versionName/versionCode, SHA256 and file size.
- [ ] **Step 8:** Upload all artifacts with `if-no-files-found: error`.

### Task 3: Verify the build and hand off the APK

**Files:**
- Read only: GitHub Actions run, uploaded artifact files.

**Interfaces:**
- Consumes: Completed release workflow.
- Produces: Downloadable APK delivered to the user with verified metadata.

- [ ] **Step 1:** Wait for the release workflow to reach a terminal state.
- [ ] **Step 2:** If it fails, inspect the failing job logs and fix only the demonstrated root cause, then rerun.
- [ ] **Step 3:** Confirm monitor contracts, TypeScript, EAS build, signing verification and artifact upload all succeeded.
- [ ] **Step 4:** Download the workflow artifact and extract the APK.
- [ ] **Step 5:** Report the exact release version, source commit, APK filename, size and SHA256, and provide the APK download link.
