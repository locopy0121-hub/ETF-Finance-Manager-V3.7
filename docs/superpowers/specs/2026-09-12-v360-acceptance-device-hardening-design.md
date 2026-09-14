# V3.6.0 Acceptance & Device Hardening Design

## Purpose

PR12 converts the remaining V3.6.0 A–K acceptance gap from an informal physical-device checklist into a repeatable acceptance workflow. It does not change finance formulas, persisted accounting records, holdings, ledger, dividend logic, or simulation behavior.

## Scope

This PR adds an acceptance manifest, an automated static acceptance audit, and a device verification checklist covering the physical-device items already listed in `docs/V360_A_K_COMPLETION_AUDIT.md`:

- Android system navigation, safe-area, cutout and OEM inset behavior.
- Keyboard avoidance for long forms, modals, sheets, rotation and large fonts.
- Universal Editor touch ergonomics and long-list scrolling.
- Widget rendering/update/click behavior and renderer fallbacks.
- Floating overlay permission, service lifecycle, drag/resize/minimize/restore/close behavior.
- All 12 monitor templates across compact/normal/expanded size expectations.
- Relaunch/offline persistence for watchlist and quote-source behavior.
- APK device-matrix evidence capture.

## Architecture

Acceptance requirements are represented as data in one manifest file rather than hard-coded independently in multiple scripts. A Node audit reads that manifest and verifies that every acceptance area has a stable ID, an owner surface, a verification mode, evidence instructions, and at least one static/runtime hook. The audit produces deterministic JSON and Markdown reports under `docs/generated/`.

The existing `npm run preflight` remains the code-safety gate. PR12 adds a separate `npm run audit:device-acceptance` command and a combined `npm run preflight:acceptance` command. Physical-device evidence is explicitly distinguished from static PASS so the tooling never claims hardware verification that did not occur.

## Acceptance Model

Each acceptance item contains:

- `id`: stable machine-readable identifier.
- `area`: `system`, `keyboard`, `editor`, `widget`, `overlay`, `monitor-template`, `watchlist`, or `apk-matrix`.
- `title`: human-readable verification target.
- `verification`: `static`, `device`, or `hybrid`.
- `surface`: exact source/runtime surface being verified.
- `staticHooks`: source files or audit checks that must exist.
- `deviceSteps`: exact manual device steps.
- `expected`: observable pass criteria.
- `evidence`: what screenshot/log/note should be captured.

Generated reports summarize `staticPass`, `devicePending`, and `deviceVerified` separately. `deviceVerified` is never inferred from source inspection.

## Files

Create:

- `scripts/V360_DEVICE_ACCEPTANCE_MANIFEST.cjs` — canonical acceptance requirement data.
- `scripts/V360_DEVICE_ACCEPTANCE_AUDIT.cjs` — validates manifest structure and static hooks, emits deterministic reports.
- `docs/generated/v360-device-acceptance.json` — generated machine-readable status.
- `docs/generated/V360_DEVICE_ACCEPTANCE.md` — generated human checklist/report.

Modify:

- `package.json` — add `audit:device-acceptance` and `preflight:acceptance` scripts.
- `docs/V360_A_K_COMPLETION_AUDIT.md` — point K acceptance to the generated device acceptance report without marking physical checks complete.

## Constraints

- No changes to `src/v3/engine.ts`, `src/v3/formulaEngine.ts`, `src/domain/metrics.ts`, `src/domain/simulation.ts`, holding/ledger/dividend persisted formats, or finance formulas.
- No OTA publish, EAS build, APK build, or PR merge as part of implementing the harness.
- Generated outputs must be deterministic across Windows and Linux.
- Static PASS must never be presented as physical-device PASS.
- Existing `npm run preflight` behavior must remain intact.

## Testing

Implementation is accepted when:

1. `node scripts/V360_DEVICE_ACCEPTANCE_AUDIT.cjs` exits 0 with all manifest/static checks valid.
2. Re-running the audit produces byte-stable generated JSON/Markdown.
3. `npm run audit:architecture` remains fully PASS.
4. `npx tsc --noEmit` returns 0 errors.
5. `npm run preflight` remains PASS.
6. `git diff --check` returns no errors.
7. No finance-core file appears in `git diff --name-only`.
