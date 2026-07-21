# Identifiers we declare carry meaning

Identifiers must be long enough, and specific enough, to say what they hold.

## Why it is a rule

Naming is where generated code drifts fastest. `data`, `res`, `tmp`, `item` and
`val` are the highest-frequency identifiers in any training corpus, so they are
what a model reaches for by default, and no type checker objects.

## What is expected

A name that says what the value *is*. `parsedQuote`, not `data`. `response`, not
`res`.

## Exceptions

Names imposed by a library, or conventional in a published algorithm, are real.
Add them to the rule's `allow` option, or mark the line:

```ts
// vibator-ignore: published cyrb53 state name
let h1 = 0xdeadbeef ^ seed;
```

The reason is mandatory — an unexplained exemption is the drift this rule
exists to stop.
