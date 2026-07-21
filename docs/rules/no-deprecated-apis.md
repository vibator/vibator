# No use of APIs marked @deprecated

No call or reference may reach a declaration carrying an `@deprecated` tag.

## Why it is a rule

Deprecation is the one compiler signal deliberately not an error. The code keeps
building, keeps passing tests, and keeps working right up to the major release
that deletes it. Editors strike it through and nothing else notices — least of
all a generated patch, which reproduces whatever pattern was most common in its
training data and so reaches for the older API more often than the newer one.

## What is expected

Use the replacement named in the finding. Library authors put it in the tag.

## Accuracy

Calls are judged by the overload actually resolved, not by the symbol, so a
deprecated overload nobody called is not reported. Options written in config
objects are resolved through the contextual type, so a deprecated *option* is
caught as well as a deprecated function.
