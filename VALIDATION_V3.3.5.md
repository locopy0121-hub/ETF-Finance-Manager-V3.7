# V3.3.5 Validation

- TypeScript `transpileModule` syntax diagnostics: 0 for modified core files.
- Full `npm install` was attempted in the build workspace but dependency installation exceeded the available execution window, so a complete `tsc --noEmit` dependency-aware check could not be completed here.
- OTA publish script still runs `npm install`, `expo install --check`, and `tsc --noEmit` before publishing, so Windows publish will stop before EAS Update if a dependency-aware type check fails.
