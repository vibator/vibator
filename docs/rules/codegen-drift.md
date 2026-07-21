# Generated files match the source they derive from

Regenerating must not change anything already committed.

## Why it is a rule

Database migrations against a schema, API clients against a spec, types against
a query — the failure is always the same shape. The code typechecks, the tests
pass against freshly generated output, and it breaks only where the *committed*
artifact is the one that runs.

## What is expected

Run the generator and commit its output alongside the source it derives from,
in the same commit.

## If the rule refuses

It declines to run when the generated paths already have uncommitted changes: it
reverts what it generates, and cannot tell your work from its own. Commit or
discard those paths first.
