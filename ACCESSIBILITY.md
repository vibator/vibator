# Accessibility

vibator is a command-line tool. Its interface is the report it prints and its
documentation. Both aim to work with a screen reader, with a screen magnifier,
and without color.

The site at [vibator.dev](https://vibator.dev) has its own
[accessibility statement](https://github.com/vibator/vibator.dev/blob/main/ACCESSIBILITY.md).

## What the command line does

- The report names the severity of each finding as a word, `error` or `warn`. Color is never the only signal.
- `NO_COLOR` turns colors off. `FORCE_COLOR` turns them on when the output is not a terminal.
- The spinner draws only on a terminal. It stays off when `TERM=dumb`, and `--no-progress` turns it off, so a screen reader reads the report alone.
- Each finding starts on its own line with the file, the line, the severity, the rule, and the message.
- `--reporter json` and `--reporter sarif` give the same findings to tools that present them their own way, such as an editor or code scanning.
- Each finding keeps what is wrong, the standard, and the next action in separate fields, in plain words.

## What the documentation does

- Images carry alt text, or `alt=""` when they are decoration.
- Headings do not skip a level.
- Link text names where the link goes.

## How it is checked

- Tests cover the spinner on a terminal, with `TERM=dumb`, and with `--no-progress`.
- The rule `.vibator/markdown-accessible.ts` checks every Markdown file in the repository for alt text, heading levels, and link text. `npm run verify` runs it.

## Known limitations

- The code under each finding has line numbers and a `|` separator, which a screen reader reads aloud. `--reporter json` leaves them out.
- The colors are the terminal's red and yellow. Their contrast depends on the terminal theme.
- The messages are English only.
- VoiceOver, NVDA, JAWS, and Orca have not been tested by hand.

## Report a barrier

[Open an accessibility issue](https://github.com/vibator/vibator/issues/new?template=03_accessibility.yml)
and say what stopped you, with which command, terminal, and assistive
technology. Every report is read. There is no fixed timeline for a fix.
