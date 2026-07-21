# Array methods over single-statement loops

A loop whose body is one statement, with no `break`, `continue`, `return` or
`await`, is an array method written the long way.

## Why it is a rule

The array method names the operation. `map` says a value comes back per element,
`filter` says some are dropped, `forEach` says none of it is used. A bare `for`
says only that something repeats, leaving the reader to work out which.

## What is expected

`forEach`, `map`, `filter`, `flatMap` or `reduce`, whichever names what the loop
does.

## Why it ships as a warning

The check is syntactic: it cannot know what the loop iterates. A `Set`, a
`Map` or a generator carries no `map` or `filter`, so a single-statement loop
over one can be flagged although the rewrite is not strictly possible. Convert
with `[...iterable]` where that reads well, use the marker where it does not —
and raise the rule to `error` in config once your codebase's loops are mostly
over arrays. If you run Biome's `noForEach` or a similar rule pointing the
opposite way, keep only one of the two.

## Exceptions

This is not a ban on loops. Bodies with control flow are left alone, because
they cannot be expressed as an array method. A hot path where a per-iteration
closure allocation is a measured cost is a real exception:

```ts
// vibator-ignore: hot path — runs per audio frame of a live call
for (let index = 0; index < input.length; index++) {
```

The reason is mandatory.
