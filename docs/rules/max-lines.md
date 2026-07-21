# No source file longer than the budget

Files longer than the configured budget do too many things.

## Why it is a rule

Most linters cap the length of a function. Almost none cap the length of a
file, and that is where problems accumulate: each edit adds one more handler
to the module it is already in, every change is individually reasonable, and
the file passes a thousand lines without any single commit looking wrong.
Code written by generation tools is especially prone to this, because the
default action is always to extend the current file.

## What is expected

Split the file into modules that each have one reason to change. Extract a
cohesive part (a type and its helpers, one subsystem, one screen) rather
than cutting at an arbitrary line.

## What is not acceptable

Raising the budget so the number fits, or narrowing the rule's globs so the
file is not scanned. Both hide the problem instead of fixing it.
