# Project-banned patterns stay out of the source

Lines matching a pattern the project has banned are reported with the
message, expectation and fix the project itself wrote.

## Why it is a rule

Most standards that keep coming up in code review are pattern-shaped: a
client that must not be imported directly, a legacy module new code must not
reach into, a `TODO` without a ticket, a hard-coded hostname. Each one is
too project-specific to ship as a built-in rule and too small to justify a
plugin, so it gets repeated in review instead of enforced.

This rule turns those review comments into configuration:

```json
"banned-patterns": {
  "severity": "error",
  "options": {
    "patterns": [
      {
        "pattern": "from \"axios\"",
        "message": "Imports axios directly",
        "expected": "HTTP goes through src/api/client",
        "fix": "Import the client from src/api/client instead"
      }
    ]
  }
}
```

## What is expected

Every pattern carries its own `message`, `expected` and `fix`, written with
the same care as a built-in rule's. The message states what is wrong, the
expectation states the standard positively, and the fix is an action a
person or a tool can take without asking. A pattern whose fix cannot be
stated in one line is a design discussion, not a ban.

Patterns match line by line against the file's text, comments included. If a
pattern should not match prose or examples, make the pattern itself more
precise; this rule does not guess which lines are code.

## Exceptions

A line that legitimately matches is opted out on the line above, with a
required reason:

```ts
// vibator-ignore: the client itself is the one wrapper allowed to import axios
import axios from "axios";
```

`#` and `<!--` comments work the same way in config files and Markdown. The
bare marker without a reason does not match.

## When to write a real rule instead

A pattern that needs context a regular expression cannot see (types, scopes,
import graphs) has outgrown this rule. Write a plugin rule; see
`vibator docs writing-rules`.
