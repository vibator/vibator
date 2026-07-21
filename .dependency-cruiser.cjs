/**
 * Architecture boundaries. The directories are the layers:
 *   src/core       — the engine; generic, knows no rule and no reporter
 *   src/rules      — the built-in rules; feed the engine, know no reporter
 *   src/reporters  — presentation; draw from engine events only
 *   src/cli(.ts)   — the composition root; the only place allowed to know all
 * Run with `npm run arch`.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment:
        "Circular dependencies make the graph hard to reason about/test.",
      from: {},
      to: { circular: true },
    },
    {
      name: "core-stays-generic",
      severity: "error",
      comment:
        "The engine must not know any concrete rule or reporter — rules and " +
        "reporters plug into it, never the other way round.",
      from: { path: "^src/core/", pathNot: "\\.test\\.ts$" },
      to: { path: "^src/(rules|reporters|cli)" },
    },
    {
      name: "rules-do-not-reach-out",
      severity: "error",
      comment:
        "Rules produce diagnostics; presenting them is someone else's job.",
      from: { path: "^src/rules/", pathNot: "\\.test\\.ts$" },
      to: { path: "^src/(reporters|cli)" },
    },
    {
      name: "reporters-draw-from-core-only",
      severity: "error",
      comment: "Reporters render engine events; they never consult a rule.",
      from: { path: "^src/reporters/", pathNot: "\\.test\\.ts$" },
      to: { path: "^src/(rules|cli)" },
    },
    {
      name: "typescript-stays-dynamic",
      severity: "error",
      comment:
        "`typescript` is an optional peer. A static value import would make " +
        "every text-only user install it; only type-only imports and " +
        "`await import` are allowed (see CLAUDE.md).",
      from: { path: "^src/" },
      to: {
        path: "^node_modules/typescript/",
        dependencyTypesNot: ["type-only"],
        dynamic: false,
      },
    },
    {
      name: "no-test-deps-in-src",
      severity: "error",
      comment: "Production code must not import test files.",
      from: { pathNot: "\\.test\\.ts$" },
      to: { path: "\\.test\\.ts$" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    // Resolve type-only imports so the boundary rules can allow them.
    tsPreCompilationDeps: true,
    exclude: {
      path: "node_modules|^dist/|^coverage/",
    },
  },
};
