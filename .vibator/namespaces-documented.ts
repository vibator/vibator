import { defineRule, vibator } from "vibator";

export default defineRule({
  id: "namespaces-documented",
  title: "Every namespace has a section in vibator-namespace.md",
  docs: "./docs/design/vibator-namespace.md",
  check: () => {
    const doc = vibator.project.files.get(
      `${vibator.project.root}/docs/design/vibator-namespace.md`,
    );
    const sections = new Set(
      vibator.text.matches(doc, /^## (\w+)$/m).map((match) => match.groups[0]),
    );
    return vibator.text
      .search(
        vibator.project.files.match("src/namespace/index.ts"),
        /^ {2}(\w+)[:,]$/m,
      )
      .filter((hit) => !sections.has(hit.groups[0] ?? ""))
      .map((hit) => ({
        ...hit,
        message: `The namespace "${hit.groups[0]}" has no section in vibator-namespace.md.`,
        expected: "Every namespace on the vibator object has a ## section.",
        fix: `Add a "## ${hit.groups[0]}" section with its declarations table.`,
      }));
  },
});
