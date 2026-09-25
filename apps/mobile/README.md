# apps/mobile (placeholder — P2)

Not built yet. Per `docs/CONTEXT.md` section 5.2 and the roadmap in section 16, this becomes an
Expo (React Native) app with Expo Router and EAS Build/Submit/Update, sharing `packages/core`,
`packages/api-client`, and `packages/design-tokens` (as an RN theme via NativeWind) with `apps/web`.

Scope when P2 starts: Feed, Rate, Library, Profile tabs; reflowed reader in a WebView; push
notifications; universal links; offline caching for saved papers. Follow Expo's official pnpm
monorepo guide when scaffolding — it's the one place nested-monorepo tooling (Metro bundler
config, dependency hoisting) tends to need extra care.

Do not start building here until P0/P1 (`apps/web`, `apps/api`) are stable — see
`PROMPT_01_WEB.md`'s milestone sequencing.
