# No unresolved merge conflict markers

A committed `<<<<<<< `, `||||||| `, `=======` or `>>>>>>> ` line means a merge
was left half-done.

## Why it is a rule

TypeScript will not compile with a marker in it, so the compiler catches
those. Nothing catches them in JSON, Markdown, SQL migrations, locale files,
YAML or env examples. Those formats accept the markers silently and ship
them.

## What is expected

Finish the merge. Delete every marker line and keep the intended side.

## Notes

`|||||||` only appears when `merge.conflictStyle` is `diff3`, which is why it
is the marker most often left behind.
