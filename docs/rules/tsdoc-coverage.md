# Every declaration carries a complete TSDoc contract

Every function-like and every type member needs a TSDoc block, with `@param`
per parameter and `@returns` when something is returned.

## Why it is a rule

Undocumented code forces the next reader to infer the contract from the
implementation, which is how a refactor silently changes behavior. This
applies to tools as much as to people: anything editing the code later works
from what the declaration says about itself.

## What is expected

- A `/** */` block above the declaration, exported or not.
- `@param` for each parameter, `@returns` when a value is returned.
- `//` is for code; a `//` line above a declaration is documentation in the
  wrong form.
- Runs of `//` comments stay short. Longer explanation belongs in the
  enclosing TSDoc block.

## Options

The default requires documentation on everything, module-local or not. A
codebase adopting the rule late can start lower and tighten over time:

- `requireOn: "exported"` checks only the surface other files consume.
- `requireParams: false` and `requireReturns: false` waive the tag checks
  and keep only the requirement that a TSDoc block exists.
- `maxInlineCommentLines` moves the cap on `//` runs (default 2).

## What is not checked

Whether the prose is any good. That remains a human question.
