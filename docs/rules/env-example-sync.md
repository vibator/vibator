# The example env file matches what the code reads

Every variable the code reads should be documented, and every documented
variable should be one the code reads.

## Why it is a rule

The example file is the only description of what a deployment must supply,
and nothing links it to the code, so it rots in both directions. An
undocumented variable is one a production deployment silently runs without.
A documented variable nothing reads is one operators keep setting for no
reason.

## What is expected

Add the variable with a comment describing what it does and its default. A
live `NAME=value`, a commented `# NAME=value`, or a name leading an aligned
comment table all count as documented.

## What counts as a read

Direct property and index access on `process.env` and `import.meta.env`,
`Deno.env.get(...)` and `Bun.env.*`, helper calls like `envNumber("NAME")`,
and destructuring. `const { API_URL, PORT = "3000" } = process.env` counts
each ALL_CAPS name it binds, renames included.

## Limits

Matching is textual, so a name assembled at runtime from a prefix is missed.
Spelling variable names out in full is what keeps this rule working.
Variables consumed outside the scanned sources, by a compose file or a
container entrypoint, belong in the `externallyConsumed` option.
