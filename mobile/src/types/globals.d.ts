/**
 * Expo / Metro injects `__DEV__` as a global boolean at runtime (true in dev
 * builds, false in production). TypeScript needs an ambient declaration so the
 * flag can be used for debug-only logging and UI without compile errors.
 */
declare const __DEV__: boolean;
