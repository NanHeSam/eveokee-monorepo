# Dependency inventory — 2026-09-09

Every direct runtime and development declaration across the four workspace packages. Installed versions come from `pnpm list -r --depth 0 --json`; registry comparisons come from `pnpm outdated -r --format json`. Latest is informational, not a compatible upgrade target. Native packages must follow the chosen Expo SDK. Workspace links are local source dependencies.

## eveokee-monorepo

| Package | Scope | Declared | Installed | Registry latest | Deprecated |
|---|---|---|---|---|---|
| `concurrently` | dev | `^8.2.2` | `8.2.2` | `10.0.5` |  |
| `convex` | dev | `^1.27.3` | `1.28.0` | `1.45.0` |  |
| `turbo` | dev | `^2.0.0` | `2.5.8` | `2.10.12` |  |

## mobile

| Package | Scope | Declared | Installed | Registry latest | Deprecated |
|---|---|---|---|---|---|
| `@backend/convex` | runtime | `workspace:*` | `link:../../packages/backend` | `workspace` |  |
| `@clerk/clerk-expo` | runtime | `^2.15.3` | `2.17.1` | `2.20.0` | yes |
| `@expo/vector-icons` | runtime | `^15.0.2` | `15.0.3` | `15.1.1` |  |
| `@react-native-async-storage/async-storage` | runtime | `^2.2.0` | `2.2.0` | `3.1.1` |  |
| `@react-navigation/bottom-tabs` | runtime | `^6.6.1` | `6.6.1` | `7.18.18` |  |
| `@react-navigation/native` | runtime | `^6.1.18` | `6.1.18` | `7.3.18` |  |
| `@react-navigation/native-stack` | runtime | `^6.11.0` | `6.11.0` | `7.18.10` |  |
| `@sentry/react-native` | runtime | `^7.2.0` | `7.4.0` | `8.25.0` |  |
| `convex` | runtime | `^1.27.3` | `1.28.0` | `1.45.0` |  |
| `date-fns` | runtime | `^4.1.0` | `4.1.0` | `4.4.0` |  |
| `expo` | runtime | `54.0.13` | `54.0.13` | `57.0.21` |  |
| `expo-apple-authentication` | runtime | `~8.0.7` | `8.0.7` | `57.0.1` |  |
| `expo-auth-session` | runtime | `~7.0.8` | `7.0.8` | `57.0.11` |  |
| `expo-build-properties` | runtime | `~1.0.9` | `1.0.9` | `57.0.17` |  |
| `expo-clipboard` | runtime | `^8.0.7` | `8.0.7` | `57.0.1` |  |
| `expo-constants` | runtime | `~18.0.9` | `18.0.10` | `57.0.17` |  |
| `expo-dev-client` | runtime | `~6.0.15` | `6.0.16` | `57.0.18` |  |
| `expo-haptics` | runtime | `~15.0.7` | `15.0.7` | `57.0.2` |  |
| `expo-image-picker` | runtime | `~16.0.5` | `16.0.6` | `57.0.16` |  |
| `expo-media-library` | runtime | `~17.0.3` | `17.0.6` | `57.0.4` |  |
| `expo-notifications` | runtime | `^0.32.12` | `0.32.12` | `57.0.17` |  |
| `expo-secure-store` | runtime | `^15.0.7` | `15.0.7` | `57.0.3` |  |
| `expo-status-bar` | runtime | `~3.0.8` | `3.0.8` | `57.0.1` |  |
| `expo-system-ui` | runtime | `~6.0.7` | `6.0.8` | `57.0.3` |  |
| `expo-web-browser` | runtime | `~15.0.8` | `15.0.8` | `57.0.2` |  |
| `nativewind` | runtime | `^4.2.1` | `4.2.1` | `4.2.6` |  |
| `openai` | runtime | `^4.79.0` | `4.104.0` | `7.13.0` |  |
| `posthog-react-native` | runtime | `^4.12.0` | `4.12.0` | `4.68.4` |  |
| `react` | runtime | `19.1.0` | `19.1.0` | `19.3.0` |  |
| `react-dom` | runtime | `19.1.0` | `19.1.0` | `19.3.0` |  |
| `react-native` | runtime | `0.81.4` | `0.81.4` | `0.87.1` |  |
| `react-native-calendars` | runtime | `^1.1313.0` | `1.1313.0` | `1.1314.0` |  |
| `react-native-css-interop` | runtime | `^0.2.1` | `0.2.1` | `0.2.6` |  |
| `react-native-gesture-handler` | runtime | `~2.28.0` | `2.28.0` | `3.2.1` |  |
| `react-native-purchases` | runtime | `9.6.0` | `9.6.0` | `10.9.0` |  |
| `react-native-purchases-ui` | runtime | `9.6.0` | `9.6.0` | `10.9.0` |  |
| `react-native-qrcode-svg` | runtime | `^6.3.15` | `6.3.16` | `6.3.24` |  |
| `react-native-reanimated` | runtime | `4.1.2` | `4.1.2` | `4.6.0` |  |
| `react-native-safe-area-context` | runtime | `^5.6.1` | `5.6.1` | `5.9.1` |  |
| `react-native-screens` | runtime | `~4.16.0` | `4.16.0` | `4.27.0` |  |
| `react-native-svg` | runtime | `^15.14.0` | `15.14.0` | `15.15.5` |  |
| `react-native-track-player` | runtime | `^5.0.0-alpha0` | `5.0.0-alpha0-nightly-cad7f4b0cdea1ab20fd988debcfdbdced7907a39` | `5.0.0-alpha0-nightly-cad7f4b0cdea1ab20fd988debcfdbdced7907a39` |  |
| `react-native-video` | runtime | `^6.17.0` | `6.17.0` | `6.19.2` |  |
| `react-native-view-shot` | runtime | `^4.0.3` | `4.0.3` | `5.1.1` |  |
| `react-native-worklets` | runtime | `^0.5.1` | `0.5.2` | `0.12.2` |  |
| `react-native-worklets-core` | runtime | `^1.6.2` | `1.6.2` | `1.6.3` |  |
| `react-refresh` | runtime | `^0.18.0` | `0.18.0` | `0.19.0` |  |
| `svix` | runtime | `^1.76.1` | `1.80.0` | `2.4.0` |  |
| `tailwindcss` | runtime | `^3.4.17` | `3.4.18` | `4.3.3` |  |
| `zustand` | runtime | `^5.0.8` | `5.0.8` | `5.0.15` |  |
| `@expo/config-plugins` | dev | `^54.0.2` | `54.0.2` | `57.0.9` |  |
| `@sentry/cli` | dev | `^2.56.0` | `2.57.0` | `3.7.0` |  |
| `@testing-library/jest-native` | dev | `^5.4.3` | `5.4.3` | `5.4.3` | yes |
| `@testing-library/react-native` | dev | `^12.6.0` | `12.9.0` | `14.0.1` |  |
| `@types/jest` | dev | `^29.5.12` | `29.5.14` | `30.0.0` |  |
| `@types/react` | dev | `^19.1.17` | `19.2.2` | `19.3.0` |  |
| `babel-preset-expo` | dev | `^54.0.3` | `54.0.6` | `57.0.11` |  |
| `eslint` | dev | `^9.0.0` | `9.38.0` | `10.10.0` |  |
| `eslint-config-expo` | dev | `~10.0.0` | `10.0.0` | `57.0.2` |  |
| `jest` | dev | `^29.7.0` | `29.7.0` | `30.5.1` |  |
| `jest-expo` | dev | `~54.0.0` | `54.0.13` | `57.0.5` |  |
| `prettier-plugin-tailwindcss` | dev | `^0.6.14` | `0.6.14` | `0.8.1` |  |
| `typescript` | dev | `~5.9.2` | `5.9.3` | `7.0.2` |  |

## web

| Package | Scope | Declared | Installed | Registry latest | Deprecated |
|---|---|---|---|---|---|
| `@backend/convex` | runtime | `workspace:*` | `link:../../packages/backend` | `workspace` |  |
| `@clerk/clerk-react` | runtime | `^5.50.0` | `5.53.3` | `5.61.3` | yes |
| `@sentry/react` | runtime | `^10.17.0` | `10.22.0` | `10.74.0` |  |
| `clsx` | runtime | `^2.1.1` | `2.1.1` | `2.1.1` |  |
| `convex` | runtime | `^1.27.3` | `1.28.0` | `1.45.0` |  |
| `date-fns` | runtime | `^4.1.0` | `4.1.0` | `4.4.0` |  |
| `framer-motion` | runtime | `^12.23.24` | `12.23.24` | `13.2.0` |  |
| `gray-matter` | runtime | `^4.0.3` | `4.0.3` | `4.0.3` |  |
| `lucide-react` | runtime | `^0.511.0` | `0.511.0` | `1.43.0` |  |
| `posthog-js` | runtime | `^1.296.1` | `1.296.1` | `1.429.1` |  |
| `react` | runtime | `^19.1.0` | `19.1.0` | `19.3.0` |  |
| `react-confetti` | runtime | `^6.1.0` | `6.4.0` | `6.4.0` |  |
| `react-dom` | runtime | `^19.1.0` | `19.1.0` | `19.3.0` |  |
| `react-hot-toast` | runtime | `^2.6.0` | `2.6.0` | `2.6.0` |  |
| `react-icons` | runtime | `^5.5.0` | `5.5.0` | `5.7.0` |  |
| `react-markdown` | runtime | `^10.1.0` | `10.1.0` | `10.1.0` |  |
| `react-router-dom` | runtime | `^7.3.0` | `7.9.4` | `7.18.3` |  |
| `rehype-highlight` | runtime | `^7.0.2` | `7.0.2` | `7.0.2` |  |
| `remark-gfm` | runtime | `^4.0.1` | `4.0.1` | `4.0.1` |  |
| `tailwind-merge` | runtime | `^3.0.2` | `3.3.1` | `3.6.0` |  |
| `zustand` | runtime | `^5.0.3` | `5.0.8` | `5.0.15` |  |
| `@eslint/js` | dev | `^9.25.0` | `9.38.0` | `10.0.1` |  |
| `@testing-library/jest-dom` | dev | `^6.6.3` | `6.9.1` | `7.0.1` |  |
| `@testing-library/react` | dev | `^16.0.1` | `16.3.0` | `16.3.3` |  |
| `@testing-library/user-event` | dev | `^14.6.1` | `14.6.1` | `14.6.7` |  |
| `@types/node` | dev | `^22.15.30` | `22.18.12` | `22.20.2` |  |
| `@types/react` | dev | `^19.1.0` | `19.2.2` | `19.3.0` |  |
| `@types/react-dom` | dev | `^19.1.0` | `19.2.2` | `19.3.0` |  |
| `@vitejs/plugin-react` | dev | `^4.4.1` | `4.7.0` | `6.1.1` |  |
| `@vitest/coverage-v8` | dev | `^2.1.4` | `2.1.9` | `5.0.0` |  |
| `autoprefixer` | dev | `^10.4.21` | `10.4.21` | `10.5.5` |  |
| `babel-plugin-react-dev-locator` | dev | `^1.0.0` | `1.0.6` | `1.0.6` |  |
| `esbuild` | dev | `^0.27.0` | `0.27.0` | `0.28.2` |  |
| `eslint` | dev | `^9.25.0` | `9.38.0` | `10.10.0` |  |
| `eslint-plugin-react-hooks` | dev | `^5.2.0` | `5.2.0` | `7.1.1` |  |
| `eslint-plugin-react-refresh` | dev | `^0.4.19` | `0.4.24` | `0.5.6` |  |
| `globals` | dev | `^16.0.0` | `16.4.0` | `17.12.0` |  |
| `jsdom` | dev | `^25.0.1` | `25.0.1` | `30.0.1` |  |
| `postcss` | dev | `^8.5.3` | `8.5.6` | `8.5.28` |  |
| `tailwind-scrollbar` | dev | `^3.0.0` | `3.1.0` | `4.0.2` |  |
| `tailwindcss` | dev | `^3.4.17` | `3.4.18` | `4.3.3` |  |
| `typescript` | dev | `~5.8.3` | `5.8.3` | `7.0.2` |  |
| `typescript-eslint` | dev | `^8.30.1` | `8.46.2` | `8.70.0` |  |
| `vite` | dev | `^6.3.5` | `6.4.1` | `8.2.2` |  |
| `vite-tsconfig-paths` | dev | `^5.1.4` | `5.1.4` | `6.1.1` |  |
| `vitest` | dev | `^2.1.4` | `2.1.9` | `5.0.0` |  |

## @backend/convex

| Package | Scope | Declared | Installed | Registry latest | Deprecated |
|---|---|---|---|---|---|
| `@ai-sdk/gateway` | runtime | `^1.0.41` | `1.0.41` | `4.0.78` |  |
| `@ai-sdk/google` | runtime | `^2.0.40` | `2.0.40` | `4.0.67` |  |
| `@ai-sdk/openai` | runtime | `^2.0.71` | `2.0.71` | `4.0.65` |  |
| `@clerk/backend` | runtime | `^2.17.2` | `2.19.0` | `3.17.2` |  |
| `@google/generative-ai` | runtime | `^0.24.1` | `0.24.1` | `0.24.1` |  |
| `@sindresorhus/slugify` | runtime | `^3.0.0` | `3.0.0` | `3.0.1` |  |
| `@vapi-ai/server-sdk` | runtime | `^0.10.2` | `0.10.2` | `1.2.0` |  |
| `ai` | runtime | `^5.0.98` | `5.0.98` | `7.0.97` |  |
| `convex` | runtime | `^1.31.0` | `1.31.0` | `1.45.0` |  |
| `date-fns` | runtime | `^3.6.0` | `3.6.0` | `4.4.0` |  |
| `date-fns-tz` | runtime | `^3.2.0` | `3.2.0` | `3.2.0` |  |
| `openai` | runtime | `^6.9.1` | `6.9.1` | `7.13.0` |  |
| `svix` | runtime | `^1.76.1` | `1.80.0` | `2.4.0` |  |
| `turndown` | runtime | `^7.2.2` | `7.2.2` | `7.2.4` |  |
| `zod` | runtime | `4.1.12` | `4.1.12` | `4.6.1` |  |
| `@edge-runtime/vm` | dev | `^5.0.0` | `5.0.0` | `5.0.0` |  |
| `@vitest/spy` | dev | `^3.2.4` | `3.2.4` | `5.0.0` |  |
| `convex-test` | dev | `^0.0.41` | `0.0.41` | `0.0.57` |  |
| `vitest` | dev | `^2.1.4` | `2.1.9` | `5.0.0` |  |
