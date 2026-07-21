# No unresolved merge conflict markers

A committed `<<<<<<< `, `||||||| `, `=======` or `>>>>>>> ` line means a merge
was abandoned half-done.

## Why it is a rule

TypeScript will not compile with a marker in it, so the compiler catches those.
Nothing catches them in JSON, Markdown, SQL migrations, locale files, YAML or
env examples — those accept the markers silently and ship them.

## What is expected

Finish the merge. Delete every marker line and keep the side you meant.

## Notes

`|||||||` only appears when `merge.conflictStyle` is `diff3`, which is why it is
the one most often left behind.
