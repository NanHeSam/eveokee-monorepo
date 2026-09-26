/// <reference types="nativewind/types" />

// Side-effect CSS imports (e.g. `import "./global.css"` for NativeWind) have no
// type declarations; TypeScript 6 reports TS2882 without this wildcard module.
declare module "*.css";
