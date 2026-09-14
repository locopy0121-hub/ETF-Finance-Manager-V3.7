# V3.6.0 Acceptance & Device Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic V3.6.0 device-acceptance harness that separates static verification from physical-device evidence and closes the tooling gap in A–K item K without changing finance core.

**Architecture:** A canonical CommonJS manifest defines every remaining device-acceptance item. A CommonJS audit validates manifest structure and static source hooks, then generates deterministic JSON/Markdown reports. Package scripts expose the audit independently and as an acceptance preflight while preserving the existing `preflight` command.

**Tech Stack:** Node.js >=22.13.0, CommonJS audit scripts, npm scripts, Markdown/JSON generated evidence, TypeScript 6.0.3 project validation.

**Spec:** `docs/superpowers/specs/2026-09-12-v360-acceptance-device-hardening-design.md`

## Global Constraints

- Do not modify `src/v3/engine.ts`, `src/v3/formulaEngine.ts`, `src/domain/metrics.ts`, `src/domain/simulation.ts`, holding/ledger/dividend persisted formats, or finance formulas.
- Do not publish OTA, run EAS Build, build APK, or merge the PR while implementing the harness.
- Generated output must be deterministic across Windows and Linux.
- Static PASS must never be presented as physical-device PASS.
- Preserve the existing `npm run preflight` behavior.

---

### Task 1: Canonical device acceptance manifest

**Files:**
- Create: `scripts/V360_DEVICE_ACCEPTANCE_MANIFEST.cjs`
- Test: `scripts/V360_DEVICE_ACCEPTANCE_AUDIT.cjs` in Task 2

**Interfaces:**
- Produces: `module.exports = { version, areas, items }`
- Each item shape: `{ id, area, title, verification, surface, staticHooks, deviceSteps, expected, evidence }`

- [ ] **Step 1: Create the manifest with the eight acceptance areas**

Define `areas` as:

```js
const areas = ['system','keyboard','editor','widget','overlay','monitor-template','watchlist','apk-matrix'];
```

Populate items for every physical-device verification sentence in `docs/V360_A_K_COMPLETION_AUDIT.md`. Use stable IDs such as `system.safe-area-navigation`, `keyboard.last-input-visible`, `widget.update-click`, `overlay.lifecycle`, and one item per monitor template family or matrix row where the expected behavior differs.

- [ ] **Step 2: Ensure every item has explicit device evidence requirements**

Every `deviceSteps` must be a non-empty string array. Every `expected` and `evidence` must be non-empty strings. Hybrid/static items must include at least one `staticHooks` entry; pure device items may use an empty `staticHooks` array.

- [ ] **Step 3: Commit the manifest**

```bash
git add scripts/V360_DEVICE_ACCEPTANCE_MANIFEST.cjs
git commit -m "test: define V3.6.0 device acceptance manifest"
```

### Task 2: Device acceptance audit and deterministic report generation

**Files:**
- Create: `scripts/V360_DEVICE_ACCEPTANCE_AUDIT.cjs`
- Create: `docs/generated/v360-device-acceptance.json`
- Create: `docs/generated/V360_DEVICE_ACCEPTANCE.md`

**Interfaces:**
- Consumes: `{ version, areas, items }` from `./V360_DEVICE_ACCEPTANCE_MANIFEST.cjs`
- Produces process exit code 0 only when manifest and static hooks are valid.
- Produces deterministic JSON object `{ generator, version, summary, items }`.

- [ ] **Step 1: Write validation that intentionally fails on an invalid manifest copy**

Implement pure helpers first:

```js
function validateManifest({version,areas,items}) { /* returns string[] errors */ }
function checkStaticHook(hook) { /* returns {pass, detail} */ }
```

Run the helper against a temporary malformed object in a local Node one-liner and verify at least one error is returned for duplicate IDs, unknown areas, missing device steps, or invalid verification values.

- [ ] **Step 2: Implement manifest validation**

Validate:

- unique non-empty `id`
- `area` is in `areas`
- `verification` is `static`, `device`, or `hybrid`
- non-empty `title`, `surface`, `expected`, `evidence`
- `staticHooks` and `deviceSteps` are arrays
- device/hybrid items have at least one `deviceSteps` entry
- static/hybrid items have at least one `staticHooks` entry

- [ ] **Step 3: Implement static hook checks**

Support two hook forms only:

```js
{ type:'file', path:'App.tsx' }
{ type:'contains', path:'App.tsx', text:'SafeAreaView' }
```

Normalize path separators before reporting. Read UTF-8 only. A missing file or missing `contains` text is a FAIL.

- [ ] **Step 4: Generate deterministic JSON and Markdown**

Sort items by `area`, then `id` with a fixed `Intl.Collator('en-US',{usage:'sort',sensitivity:'variant',numeric:false})`. Do not write timestamps. Mark each item with:

```js
{
  staticPass: boolean,
  deviceStatus: 'pending',
  status: 'static-pass-device-pending' | 'device-pending' | 'static-fail'
}
```

The Markdown must clearly state that device verification is pending unless explicit evidence is later recorded by a separate future workflow.

- [ ] **Step 5: Run the audit twice and prove deterministic output**

```powershell
node .\scripts\V360_DEVICE_ACCEPTANCE_AUDIT.cjs
Get-FileHash .\docs\generated\v360-device-acceptance.json
Get-FileHash .\docs\generated\V360_DEVICE_ACCEPTANCE.md
node .\scripts\V360_DEVICE_ACCEPTANCE_AUDIT.cjs
Get-FileHash .\docs\generated\v360-device-acceptance.json
Get-FileHash .\docs\generated\V360_DEVICE_ACCEPTANCE.md
```

Expected: both hashes remain identical across runs.

- [ ] **Step 6: Commit audit and generated evidence**

```bash
git add scripts/V360_DEVICE_ACCEPTANCE_AUDIT.cjs docs/generated/v360-device-acceptance.json docs/generated/V360_DEVICE_ACCEPTANCE.md
git commit -m "test: add deterministic device acceptance audit"
```

### Task 3: npm acceptance commands

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `npm run audit:device-acceptance`
- Produces: `npm run preflight:acceptance`

- [ ] **Step 1: Add dedicated audit script**

Add:

```json
"audit:device-acceptance": "node scripts/V360_DEVICE_ACCEPTANCE_AUDIT.cjs"
```

- [ ] **Step 2: Add combined acceptance preflight without changing existing preflight**

Add:

```json
"preflight:acceptance": "npm run preflight && npm run audit:device-acceptance"
```

Do not modify the current `preflight` value.

- [ ] **Step 3: Run both commands**

```powershell
npm run audit:device-acceptance
npm run preflight:acceptance
```

Expected: exit code 0; existing architecture, native, finance, formula, regression, dividend and TypeScript checks remain PASS.

- [ ] **Step 4: Commit package scripts**

```bash
git add package.json
git commit -m "chore: expose V3.6.0 acceptance preflight"
```

### Task 4: Link A–K acceptance to generated evidence

**Files:**
- Modify: `docs/V360_A_K_COMPLETION_AUDIT.md`

**Interfaces:**
- Consumes: `docs/generated/V360_DEVICE_ACCEPTANCE.md`
- Produces: a truthful K row that remains `部分完成` until device evidence is actually recorded.

- [ ] **Step 1: Update K runtime evidence only**

Keep status `部分完成`. Add that deterministic acceptance tooling exists and that generated static/device-pending evidence is in `docs/generated/V360_DEVICE_ACCEPTANCE.md`. Do not claim APK/device verification complete.

- [ ] **Step 2: Run documentation-sensitive audits**

```powershell
npm run audit:architecture
npm run audit:device-acceptance
```

Expected: both PASS.

- [ ] **Step 3: Commit documentation link**

```bash
git add docs/V360_A_K_COMPLETION_AUDIT.md
git commit -m "docs: link V3.6.0 device acceptance evidence"
```

### Task 5: Final PR12 harness verification

**Files:**
- Verify only; no new source changes expected.

**Interfaces:**
- Produces: evidence that PR12 changed only acceptance tooling/docs/package scripts and did not touch finance core.

- [ ] **Step 1: Run complete acceptance preflight**

```powershell
npm run preflight:acceptance
```

Expected: exit 0.

- [ ] **Step 2: Run whitespace validation**

```powershell
git diff --check origin/main...HEAD
```

Expected: no output.

- [ ] **Step 3: Prove finance-core guard**

```powershell
git diff --name-only origin/main...HEAD -- src/v3/engine.ts src/v3/formulaEngine.ts src/domain/metrics.ts src/domain/simulation.ts
```

Expected: no output.

- [ ] **Step 4: Review final changed-file scope**

```powershell
git diff --name-only origin/main...HEAD
```

Expected files are limited to the acceptance manifest/audit, generated acceptance evidence, `package.json`, the A–K audit document, and this spec/plan documentation.

- [ ] **Step 5: Push branch for PR review**

```powershell
git push origin HEAD:pr12-acceptance-device-hardening
```

Do not merge until the generated acceptance report, full preflight, and finance-core guard are reviewed.
