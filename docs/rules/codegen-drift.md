# Generated files match the source they derive from

Regenerating must not change anything already committed.

## Why it is a rule

Database migrations against a schema, API clients against a spec, types
against a query: the failure mode is the same in each case. The code type
checks, the tests pass against freshly generated output, and the bug appears
only where the committed artifact is the one that runs.

## What is expected

Run the generator and commit its output together with the source it derives
from, in the same commit.

## If the rule refuses to run

The rule declines to check paths that already have uncommitted changes. It
reverts whatever it generates, and it cannot tell your work in progress from
its own output. Commit or discard those paths first.
