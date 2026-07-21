# No oversized files in version control

Files above the configured budget are usually build output, database dumps,
screenshots or vendored binaries committed by mistake.

## Why it is a rule

A large file bloats every clone of the repository permanently. Deleting it
later does not remove it from history, so the only cheap moment to catch it
is before it lands.

## What is expected

Commit the source, not the artifact. Generated output belongs in
`.gitignore`.

## If the file must be tracked

Some generated files legitimately have to be committed, for example a
lockfile or a wrapper jar. Add those paths to the rule's `exclude` globs,
with a comment saying why.
