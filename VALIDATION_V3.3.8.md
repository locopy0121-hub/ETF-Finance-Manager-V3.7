# V3.3.8 Validation

- Modified core TS/TSX files were parsed with the installed TypeScript compiler via `transpileModule`.
- Syntax diagnostics: 0 errors across App.tsx, V3 screens/engine, Widget renderer/sync/task handler, background quote task, and dividend event type file.
- Full dependency-aware `tsc --noEmit` cannot complete in this build workspace because project `node_modules` / `expo/tsconfig.base` are not installed here. The OTA launcher intentionally runs `npm install`, `expo install --check`, and `tsc --noEmit` before EAS Update.
- `runtimeVersion` remains 3.2.0 for OTA compatibility with the existing native base.
