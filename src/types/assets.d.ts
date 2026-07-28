/**
 * Ambient declarations for asset imports.
 *
 * Next ships types for `*.module.css` but not for plain `*.css`, so a
 * side-effect import like `import '@/app/globals.css'` has no declaration to
 * resolve to. Most setups never notice, because TypeScript only reports it when
 * `noUncheckedSideEffectImports` is on — which some editors and stricter
 * configurations enable. Declaring the modules here fixes it everywhere and
 * costs nothing at runtime: these are types only, erased at compile time.
 *
 * The bundler, not TypeScript, is what actually resolves and inlines these
 * files. This declaration just stops the type checker from objecting.
 */
declare module '*.css';
declare module '*.scss';
declare module '*.woff';
declare module '*.woff2';
