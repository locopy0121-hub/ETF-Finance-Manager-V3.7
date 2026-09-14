# V3.6.0 Device Acceptance Evidence

> This report is generated deterministically. Static PASS does **not** mean physical-device PASS. Device verification remains pending until explicit evidence is recorded by a separate workflow.

Generator: `scripts/V360_DEVICE_ACCEPTANCE_AUDIT.cjs`  
Version: `3.6.0`  
Items: 19; static pass: 19; static fail: 0; device pending: 19.

| Area | ID | Verification | Static | Device | Status | Expected evidence |
|---|---|---|---|---|---|---|
| apk-matrix | apk-matrix.package-health | device | PASS | pending | device-pending | Captured expo-doctor and expo install --check output with date and environment versions. |
| apk-matrix | apk-matrix.preview-install | device | PASS | pending | device-pending | Build identifier plus device/OS matrix with install/launch result for each row. |
| editor | editor.native-serialization | hybrid | PASS | pending | static-pass-device-pending | Before/after screenshots of the editor setting and corresponding native surface. |
| editor | editor.touch-long-list | hybrid | PASS | pending | static-pass-device-pending | Screen recording of a full top-to-bottom editor interaction. |
| keyboard | keyboard.last-input-visible | hybrid | PASS | pending | static-pass-device-pending | Screenshots or recording showing the final input with the IME open. |
| keyboard | keyboard.rotation-large-font | device | PASS | pending | device-pending | Device/OS/font-scale notes with screenshots for portrait and landscape. |
| monitor-template | monitor-template.compact | hybrid | PASS | pending | static-pass-device-pending | One screenshot per compact template at minimum size. |
| monitor-template | monitor-template.large | hybrid | PASS | pending | static-pass-device-pending | Minimum/maximum size screenshots for each large/dense template. |
| monitor-template | monitor-template.standard | hybrid | PASS | pending | static-pass-device-pending | One screenshot per standard template plus one scroll recording. |
| overlay | overlay.effect-fallback | hybrid | PASS | pending | static-pass-device-pending | Side-by-side screenshots of editor preview and overlay. |
| overlay | overlay.lifecycle | hybrid | PASS | pending | static-pass-device-pending | Screen recording covering drag, resize, minimize, restore, close, and reopen. |
| overlay | overlay.permission-policy | hybrid | PASS | pending | static-pass-device-pending | Permission-flow recording plus OEM/device notes. |
| system | system.flow-layout-scaling | hybrid | PASS | pending | static-pass-device-pending | Screenshots for narrow, large, and accessibility-font cases. |
| system | system.immersive-foreground | hybrid | PASS | pending | static-pass-device-pending | Short screen recording covering background/foreground and editor open/close. |
| system | system.safe-area-navigation | hybrid | PASS | pending | static-pass-device-pending | Screenshots for gesture and three-button navigation plus device/OS notes. |
| watchlist | watchlist.live-quotes-upgrade | hybrid | PASS | pending | static-pass-device-pending | Recording or timestamped screenshots before disconnect, after reconnect, and after relaunch/update. |
| watchlist | watchlist.persistence-offline | hybrid | PASS | pending | static-pass-device-pending | Before/after screenshots plus exported or inspected holding count showing no accounting row was created. |
| widget | widget.paint-fallback | hybrid | PASS | pending | static-pass-device-pending | Launcher screenshots covering positive, negative, neutral, and at least one degraded effect. |
| widget | widget.update-click | device | PASS | pending | device-pending | Screen recording from launcher refresh through app open. |

## Device steps

### apk-matrix.package-health — Expo/package compatibility is verified when tooling/network is available

Surface: project/package toolchain

1. Run expo-doctor and expo install --check with network/tooling available.
2. Record warnings/errors without auto-changing dependencies during acceptance.
3. Re-run TypeScript and acceptance preflight after any separately approved dependency correction.

Expected: Package/tooling health is recorded explicitly; any dependency correction is handled as a separate reviewed change rather than silently folded into device evidence.

Evidence required: Captured expo-doctor and expo install --check output with date and environment versions.

### apk-matrix.preview-install — Preview APK installs and launches on representative Android devices

Surface: Android APK

1. Build the approved preview APK outside this harness workflow.
2. Install on at least one gesture-navigation device and one three-button-navigation device or equivalent emulator profiles.
3. Launch, relaunch, and exercise core navigation.

Expected: The preview APK installs, launches, persists state, and exposes no blocking native crash across the representative matrix.

Evidence required: Build identifier plus device/OS matrix with install/launch result for each row.

### editor.native-serialization — Settings inventory edits serialize to native renderers

Surface: Settings → Special → Universal Editor

1. Edit a registered node used by Widget or floating overlay.
2. Save the edit from the app Settings inventory.
3. Refresh or reopen the target native surface.

Expected: The native surface consumes the persisted node settings without requiring a React Native modal while the app is closed.

Evidence required: Before/after screenshots of the editor setting and corresponding native surface.

### editor.touch-long-list — Universal Editor touch ergonomics and long-list scrolling

Surface: Universal Editor

1. Open Universal Editor from a registered node.
2. Expand sections with long content, including Effects and Advanced.
3. Scroll to the bottom, edit controls, then use Cancel/Reset/Save.

Expected: Section headers, controls, scrolling, and fixed footer remain usable without accidental activation or unreachable content.

Evidence required: Screen recording of a full top-to-bottom editor interaction.

### keyboard.last-input-visible — Last input remains visible above IME

Surface: ledger/dividend/calculator/settings/editor forms

1. Open the longest active form.
2. Focus the last editable field using Gboard or the OEM keyboard.
3. Scroll while the keyboard is open and rotate once if supported.

Expected: The focused field and fixed action footer stay visible and reachable above the keyboard.

Evidence required: Screenshots or recording showing the final input with the IME open.

### keyboard.rotation-large-font — Keyboard avoidance survives rotation and large fonts

Surface: active form screens

1. Enable large system font scaling.
2. Open an active form and focus a lower field.
3. Rotate portrait to landscape and back while the IME is visible where device policy permits.

Expected: No input becomes permanently hidden and the user can still reach Save/Cancel actions.

Evidence required: Device/OS/font-scale notes with screenshots for portrait and landscape.

### monitor-template.compact — Compact monitor templates fit bounded overlay sizes

Surface: floating monitor compact family

1. Select each compact/small monitor template.
2. Test minimum supported overlay size.
3. Verify fixed header/body/summary/footer regions remain usable.

Expected: Compact templates do not clip essential controls or overlap fixed regions at minimum supported size.

Evidence required: One screenshot per compact template at minimum size.

### monitor-template.large — Large/dense monitor templates remain usable across resize range

Surface: floating monitor large/dense family

1. Select each large/dense template.
2. Resize from minimum to a large window size.
3. Verify rows, columns, controls, and summary at both extremes.

Expected: Large/dense templates preserve readable columns and stable controls throughout the supported resize range.

Evidence required: Minimum/maximum size screenshots for each large/dense template.

### monitor-template.standard — Standard monitor templates render all configured fields

Surface: floating monitor standard family

1. Select each standard monitor template.
2. Populate enough holdings/watchlist rows to require scrolling.
3. Verify title, status, body, and summary content.

Expected: Standard templates render configured fields, scroll only the bounded body, and retain fixed header/summary/footer.

Evidence required: One screenshot per standard template plus one scroll recording.

### overlay.effect-fallback — Overlay advanced effects degrade compatibly

Surface: Android floating overlay

1. Apply gradient/glow/shadow/shimmer/sweep capable node settings.
2. Open the native overlay.
3. Compare semantic colors and emphasis with the in-app editor preview.

Expected: Native fallback preserves semantic color/emphasis and remains legible even where blur or continuous animation is unsupported.

Evidence required: Side-by-side screenshots of editor preview and overlay.

### overlay.lifecycle — Floating overlay close, minimize, restore, drag and resize lifecycle

Surface: Android floating overlay

1. Open the floating monitor.
2. Drag and resize it, then minimize and restore it.
3. Close the window and reopen it from the app without restarting the service manually.

Expected: Position/size interactions work, minimize/restore is stable, and close/reopen follows the configured lifecycle without stale or duplicated windows.

Evidence required: Screen recording covering drag, resize, minimize, restore, close, and reopen.

### overlay.permission-policy — Floating overlay permission and OEM policy handling

Surface: Android floating overlay

1. Start with overlay permission denied.
2. Request permission and enable the floating monitor.
3. Background the app and observe behavior under the device OEM background policy.

Expected: Permission denial is recoverable, enabling succeeds after permission grant, and OEM restrictions fail gracefully without corrupting app state.

Evidence required: Permission-flow recording plus OEM/device notes.

### system.flow-layout-scaling — Flow layout scales across screen widths and font sizes

Surface: V3 cards and metric grids

1. Test a narrow phone width and a large phone/tablet width.
2. Enable larger accessibility font scaling.
3. Inspect cards using each supported quick width.

Expected: Cards wrap without overlap, preserve order, and remain readable at narrow/large widths and enlarged fonts.

Evidence required: Screenshots for narrow, large, and accessibility-font cases.

### system.immersive-foreground — Immersive navigation reapplies after foregrounding

Surface: app shell

1. Launch the app and note navigation visibility.
2. Send the app to background and return to foreground.
3. Repeat after opening and closing an editor.

Expected: Configured immersive navigation is restored after foreground transitions without trapping the user in an unusable state.

Evidence required: Short screen recording covering background/foreground and editor open/close.

### system.safe-area-navigation — System navigation and safe-area behavior

Surface: app shell

1. Test gesture navigation and three-button navigation.
2. Open every active V3 tab and verify bottom controls remain above the system navigation area.
3. Repeat on a device or emulator with display cutout simulation enabled.

Expected: No active screen, modal footer, tab control, or floating action control is obscured by Android system bars or cutouts.

Evidence required: Screenshots for gesture and three-button navigation plus device/OS notes.

### watchlist.live-quotes-upgrade — Watchlist quote subscriptions survive reconnect and app update

Surface: Home/watchlist/monitor

1. Keep at least one watchlist-only ETF visible.
2. Disconnect and reconnect the network and confirm quote recovery.
3. After a compatible update/relaunch, confirm watchlist-only symbols still subscribe without entering portfolio calculations.

Expected: Watchlist-only symbols recover live quotes and remain display-only across reconnect/relaunch/update.

Evidence required: Recording or timestamped screenshots before disconnect, after reconnect, and after relaunch/update.

### watchlist.persistence-offline — Watchlist persists independently across relaunch and offline state

Surface: Home/watchlist/monitor candidate selection

1. Add and reorder watchlist symbols that are not holdings.
2. Force-close and relaunch the app.
3. Repeat once with network unavailable.

Expected: Watchlist membership/order persists without creating accounting holdings or ledger records, including offline relaunch.

Evidence required: Before/after screenshots plus exported or inspected holding count showing no accounting row was created.

### widget.paint-fallback — Widget paint fallbacks remain readable

Surface: Android launcher Widget

1. Apply theme/P&L colors and advanced effects to Widget-bound nodes.
2. Refresh the launcher Widget.
3. Check positive, negative, and neutral values.

Expected: Unsupported paint/effect primitives degrade to readable fixed/P&L colors without losing semantic state.

Evidence required: Launcher screenshots covering positive, negative, neutral, and at least one degraded effect.

### widget.update-click — Widget refresh and click behavior

Surface: Android launcher Widget

1. Add the Widget to the launcher.
2. Trigger its supported refresh interaction and observe the update timestamp/data.
3. Use the configured open-app interaction.

Expected: Refresh does not zero valid data, update feedback is visible, and the open-app interaction reaches the expected app destination.

Evidence required: Screen recording from launcher refresh through app open.

