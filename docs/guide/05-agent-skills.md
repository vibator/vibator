# Agent skills

vibator ships three skills for Claude Code and compatible agents:

- `writing-vibator-rules`: write a rule instead of a check script.
- `fixing-vibator-findings`: read a report and resolve its findings.
- `configuring-vibator`: set severities, options, extends, plugins, and excludes.

```sh
npx vibator skills --install   # copy into .claude/skills/
```

The writing skill tells the agent to write a rule before it writes a
`scripts/check-*` file, a test that reads repository files, or a line in
AGENTS.md that nothing checks.

## Agents without skill support

The same material is available from the command line, so any agent can use it:

```sh
npx vibator explain <rule>    # the guideline behind a rule
npx vibator --reporter json   # machine-readable findings
```

Each finding in the JSON report carries its rule id, severity, location, and
the three fields an agent acts on: `message`, `expected`, and `fix`.
