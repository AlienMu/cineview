export interface ParsedDocSource {
  title: string;
  eyebrow: string;
  markdown: string;
}

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function readScalar(value: string): string {
  const quoted = /^(['"])([\s\S]*)\1$/.exec(value);
  if (!quoted) return value;
  if (quoted[1] === "'") return quoted[2].replace(/''/g, "'");
  try {
    return JSON.parse(value) as string;
  } catch {
    return quoted[2];
  }
}

/** Read the documentation's title/eyebrow scalar header and preserve its body. */
export function parseDocSource(source: string): ParsedDocSource {
  const match = FRONTMATTER_PATTERN.exec(source);
  if (!match) return { title: '', eyebrow: '', markdown: source };
  const meta: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const keyValuePair = /^([a-zA-Z]+):\s*(.*)$/.exec(line);
    if (keyValuePair) meta[keyValuePair[1]] = readScalar(keyValuePair[2].trim());
  }
  return { title: meta.title ?? '', eyebrow: meta.eyebrow ?? '', markdown: match[2] };
}
