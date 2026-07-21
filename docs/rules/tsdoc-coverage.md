# Every declaration carries a complete TSDoc contract

Every function-like and every type member needs a TSDoc block, with `@param`
per parameter and `@returns` when something is returned.

## Why it is a rule

Undocumented code is where intent goes missing, and an agent reading it later
has to infer the contract from the implementation — which is exactly how a
refactor silently changes behaviour.

## What is expected

- A `/** */` block above the declaration, exported or not.
- `@param` for each parameter, `@returns` when a value is returned.
- `//` is for code; a `//` line above a declaration is documentation in the
  wrong form.
- Runs of `//` comments stay short; longer explanation belongs in the enclosing
  TSDoc block.

## Options

The default bar is this package's own: everything documented, module-local or
not. A codebase adopting the rule late can start lower and ratchet up:

- `requireOn: "exported"` asks only for the surface other files consume.
- `requireParams: false` / `requireReturns: false` waive the tag checks and
  keep only the "a TSDoc block exists" bar.
- `maxInlineCommentLines` moves the cap on `//` runs (default 2).

## What is not checked

Whether the prose is any good. That stays a human question.
