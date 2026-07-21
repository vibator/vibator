# Array methods over single-statement loops

A loop whose body is one statement, with no `break`, `continue`, `return` or
`await`, can usually be written as an array method.

## Why it is a rule

The array method names the operation. `map` says a value comes back per
element, `filter` says some are dropped, `forEach` says nothing is returned.
A bare `for` says only that something repeats, and leaves the reader to work
out which case applies.

## What is expected

`forEach`, `map`, `filter`, `flatMap` or `reduce`, whichever names what the
loop does.

## Why it ships as a warning

The check is syntactic and cannot know what the loop iterates. A `Set`, a
`Map` or a generator has no `map` or `filter`, so a single-statement loop
over one can be flagged even though a direct rewrite is not possible.
Convert with `[...iterable]` where that reads well, use the ignore marker
where it does not, and raise the rule to `error` in config once your
codebase's loops are mostly over arrays. If you run Biome's `noForEach` or a
similar rule pointing the opposite way, keep only one of the two.

## Exceptions

This is not a ban on loops. Bodies with control flow are left alone, because
they cannot be expressed as an array method. A hot path where a
per-iteration closure allocation is a measured cost is a legitimate
exception:

```ts
// vibator-ignore: hot path, runs per audio frame of a live call
for (let index = 0; index < input.length; index++) {
```

The reason is required.
