// ncaaf-line-desk.jsx is a hand-kept mirror of the component embedded in
// index.html. This fails the moment the two drift, instead of whenever
// someone happens to notice.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

// The only lines allowed to differ are how each copy gets React and the
// libs in, and how it's mounted. Strip those, then compare what's left.
function embedded() {
  const html = read("index.html");
  const start = html.indexOf('<script type="text/babel"');
  const body = html.slice(html.indexOf(">", start) + 1, html.indexOf("</script>", start));
  const lines = body.split("\n");
  const from = lines.findIndex((l) => /const \{[^}]*\} = React;/.test(l)) + 1;
  const to = lines.findIndex((l) => /^\s*class ErrorBoundary\b/.test(l));
  assert.ok(from > 0 && to > from, "couldn't find the component inside index.html");
  return lines.slice(from, to).join("\n")
    .replace(/window\.(OddsMath|FieldGeometry)\b/g, "$1");
}

function mirror() {
  return read("ncaaf-line-desk.jsx").split("\n")
    .filter((l) => !/^import React\b/.test(l) && !/require\("\.\/lib\//.test(l))
    .join("\n")
    .replace(/^(\s*)export default function\b/m, "$1function");
}

const norm = (s) => s.split("\n").map((l) => l.trim()).filter(Boolean);

test("ncaaf-line-desk.jsx matches the component embedded in index.html", () => {
  const a = norm(embedded()), b = norm(mirror());
  const i = a.findIndex((l, k) => l !== b[k]);
  if (i === -1 && a.length === b.length) return;
  const at = i === -1 ? Math.min(a.length, b.length) : i;
  assert.fail(`copies diverge at component line ${at + 1}:\n` +
    `  index.html:          ${a[at] ?? "<end>"}\n` +
    `  ncaaf-line-desk.jsx: ${b[at] ?? "<end>"}\n` +
    "Apply the same edit to both files.");
});
