// Extract a simple usage snippet from README markdown.
// Heuristics: Prefer first code block under a heading containing 'usage' or 'example'.

export type Snippet = { language?: string; code: string; heading?: string } | undefined;

export function extractUsageSnippet(readme?: string): Snippet {
  if (!readme) return undefined;
  const lines = readme.split(/\r?\n/);
  // track headings
  const headingIndices: { i: number; text: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const m = /^\s{0,3}#{1,6}\s+(.*)$/.exec(l);
    if (m) headingIndices.push({ i, text: m[1].toLowerCase() });
  }
  // find candidate headings
  const candidates = headingIndices.filter((h) => /usage|example|getting started|quick start/.test(h.text));
  // parse code blocks
  type Block = { start: number; end: number; lang?: string; code: string };
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const startMatch = /^\s*```(\w+)?\s*$/.exec(lines[i]);
    if (startMatch) {
      const lang = startMatch[1];
      let j = i + 1;
      while (j < lines.length && !/^\s*```\s*$/.test(lines[j])) j++;
      const code = lines.slice(i + 1, j).join("\n");
      blocks.push({ start: i, end: j, lang, code });
      i = j + 1;
      continue;
    }
    i++;
  }
  if (blocks.length === 0) return undefined;

  // If heading candidates exist, pick first block that comes after the first candidate
  if (candidates.length > 0) {
    const anchor = candidates[0];
    const block = blocks.find((b) => b.start > anchor.i);
    if (block?.code.trim()) return { language: block.lang, code: block.code, heading: anchor.text };
  }

  // Fallback to first block that looks like JS/TS or shell install
  const pref = blocks.find((b) => /^(js|jsx|ts|tsx|bash|sh|shell|zsh)$/i.test(b.lang ?? ""));
  if (pref?.code.trim()) return { language: pref.lang, code: pref.code };
  // Fallback to first non-empty block
  const firstNonEmpty = blocks.find((b) => b.code.trim().length > 0);
  return firstNonEmpty ? { language: firstNonEmpty.lang, code: firstNonEmpty.code } : undefined;
}
