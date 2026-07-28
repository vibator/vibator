/**
 * Architecture boundaries. The directories are the layers:
 *   src/namespace     - the `vibator` object a rule reads. Bottom layer.
 *   src/rules         - defineRule, the registry, the rule types.
 *   src/configuration - .vibator.json types and load.
 *   src/engine        - loadRules and run.
 *   src/cli(.ts)      - argument parsing, subcommands, reporters. The root.
 * Run with `npm run arch`.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular dependencies make the graph hard to reason about.",
      from: {},
      to: { circular: true },
    },
    {
      name: "namespace-is-isolated",
      severity: "error",
      comment:
        "The namespace is the bottom layer. It imports no other src module.",
      from: { path: "^src/namespace/", pathNot: "\\.test\\.ts$" },
      to: { path: "^src/(rules|configuration|engine|cli)" },
    },
    {
      name: "rules-know-only-the-namespace",
      severity: "error",
      comment:
        "Rules read the namespace; they know no configuration, engine, or cli.",
      from: { path: "^src/rules/", pathNot: "\\.test\\.ts$" },
      to: { path: "^src/(configuration|engine|cli)" },
    },
    {
      name: "nobody-imports-cli",
      severity: "error",
      comment:
        "The cli is the composition root. It imports anything; nothing imports it.",
      from: { path: "^src/", pathNot: "^src/cli" },
      to: { path: "^src/cli/" },
    },
    {
      name: "typescript-stays-dynamic",
      severity: "error",
      comment:
        "`typescript` is an optional peer. A static value import would make " +
        "every text-only user install it; only type-only and dynamic loads " +
        "are allowed.",
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
    tsPreCompilationDeps: true,
    exclude: {
      path: "node_modules|^dist/|^coverage/",
    },
  },
};
