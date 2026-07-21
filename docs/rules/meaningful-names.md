# Identifiers we declare carry meaning

Identifiers must be long enough, and specific enough, to say what they hold.

## Why it is a rule

Placeholder names are where quality slips first. `data`, `res`, `tmp`,
`item` and `val` are the most common identifiers in existing code, so they
are what autocompletion and code generation reach for by default, and no
type checker objects. A reader then has to reconstruct from context what the
author already knew.

## What is expected

A name that says what the value is: `parsedQuote`, not `data`; `response`,
not `res`.

## Exceptions

Names imposed by a library, or conventional in a published algorithm, are
legitimate. Add them to the rule's `allow` option, or mark the line:

```ts
// vibator-ignore: published cyrb53 state name
let h1 = 0xdeadbeef ^ seed;
```

The reason is required. An unexplained exemption defeats the purpose of the
rule.
