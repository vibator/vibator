# No use of APIs marked @deprecated

No call or reference may reach a declaration carrying an `@deprecated` tag.

## Why it is a rule

Deprecation is the one compiler signal that is deliberately not an error.
The code keeps building, keeps passing tests, and keeps working until the
major release that removes the API. Editors strike deprecated symbols
through, but nothing fails. New code copied from older examples, including
generated code, tends to use the older API, so deprecated usage keeps
growing rather than shrinking.

## What is expected

Use the replacement named in the finding. Library authors put it in the
deprecation tag.

## Accuracy

Calls are judged by the overload actually resolved, not by the symbol, so a
deprecated overload nobody calls is not reported. Options written in config
objects are resolved through the contextual type, so a deprecated option is
caught as well as a deprecated function.
