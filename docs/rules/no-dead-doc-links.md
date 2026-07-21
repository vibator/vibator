# Relative links in Markdown point at files that exist

Every relative link and image in a Markdown file resolves to a real file in the
repository.

## Why it is a rule

Documentation is the part of a change nothing type-checks. Move or rename a
source file and every import updates or the build fails; the README that
pointed at it keeps pointing at nothing, and the first person to notice is the
reader who follows the link months later — usually while trying to learn the
very thing the link was supposed to explain. Agents are especially prone to
this: they restructure directories cleanly and update every reference the
compiler checks, which Markdown is not.

## What is expected

Relative targets (`./docs/guide.md`, `../README.md`, `images/flow.png`) exist
at the resolved path. A leading `/` resolves from the repository root. Anchors
and queries are ignored — `guide.md#setup` checks only that `guide.md` exists.

External URLs, `mailto:` links and pure `#anchor` links are not judged; this
rule only covers what a commit in this repository can break. Link syntax inside
fenced code blocks and inline code spans is documentation *about* links and is
left alone.

## Exceptions

A link that must point at a generated or git-ignored file — one that exists
after a build but not in a fresh checkout — is better rewritten to point at the
source that generates it. If it genuinely cannot be, exclude that document via
the rule's `exclude` globs rather than leaving a dead link for every reader
between builds.
