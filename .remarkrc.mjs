// Markdown formatting and link checks: `npm run docs:check`, `npm run docs:format`.
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkValidateLinks from "remark-validate-links";

/** The output style. The `markdown-formatted` rule formats with the same settings. */
export const settings = {
  bullet: "-",
  emphasis: "_",
  strong: "*",
  fence: "`",
  rule: "-",
  listItemIndent: "one",
};

export default {
  settings,
  plugins: [remarkFrontmatter, remarkGfm, remarkValidateLinks],
};
