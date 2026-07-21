# Every locale carries the same keys as the source

Every locale must define exactly the keys the source locale defines.

## Why it is a rule

Typed translation keys prove a key exists in the *source* locale. Nothing proves
it was seeded to the others, so a key added to one locale alone silently falls
back at runtime for every other language — visible only to users of those
languages, which is usually nobody on the team.

## What is expected

Add the key to the source locale, then seed the identical key into every other
locale. Copying the source text verbatim is the convention until a translation
arrives: a placeholder in the wrong language is better than a missing key.

## Keys the source does not have

Reported too, and usually a rename applied to one locale but not the rest.

## Layouts

Two catalog layouts are supported, chosen with the `layout` option:

- `directory-per-locale` (default): `locales/<locale>/<namespace>.json` — one
  directory per locale, one JSON file per namespace.
- `file-per-locale`: `locales/<locale>.json` — one flat JSON file per locale,
  `en-US.json` style region codes included.

Locales are discovered from the layout; pass `locales` explicitly to pin the
set — useful when the directory also holds files that are not catalogs.

