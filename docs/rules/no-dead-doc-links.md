# Relative links in Markdown point at files that exist

Every relative link and image in a Markdown file resolves to a real file in
the repository.

## Why it is a rule

Documentation is the part of a change nothing type checks. Move or rename a
source file and every import either updates or the build fails; a README
that pointed at the old path keeps pointing at nothing, and the first person
to notice is a reader months later. Automated refactors are especially prone
to this, because they update every reference the compiler checks, and
Markdown is not one of them.

## What is expected

Relative targets (`./docs/guide.md`, `../README.md`, `images/flow.png`)
exist at the resolved path. A leading `/` resolves from the repository root.
Anchors and queries are ignored: `guide.md#setup` checks only that
`guide.md` exists.

External URLs, `mailto:` links and pure `#anchor` links are not checked;
this rule only covers what a commit in this repository can break. Link
syntax inside fenced code blocks and inline code spans is treated as example
text and skipped.

## Exceptions

A link that must point at a generated or git-ignored file (one that exists
after a build but not in a fresh checkout) is better rewritten to point at
the source that generates it. If that is not possible, exclude the document
via the rule's `exclude` globs.
