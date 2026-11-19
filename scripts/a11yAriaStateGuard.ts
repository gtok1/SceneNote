export interface AriaStateViolation {
  file: string;
  line: number;
  rule: "R-1" | "R-2";
  snippet: string;
}

export interface JsxOpeningTag {
  text: string;
  ownText: string;
  line: number;
}

/** Keep nested JSX separate from the attributes of its containing opening tag. */
export function findJsxOpeningTags(source: string): JsxOpeningTag[] {
  const tags: JsxOpeningTag[] = [];
  let index = 0;
  let line = 1;

  const readOpeningTag = (): JsxOpeningTag[] => {
    const start = index;
    const startLine = line;
    const nested: JsxOpeningTag[] = [];
    const ownParts: string[] = [];
    let ownStart = start;
    let depth = 0;
    let quote: string | null = null;
    let escaped = false;
    index += 1;
    while (index < source.length) {
      const character = source[index]!;
      if (character === "\n") line += 1;
      if (quote !== null) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === quote) quote = null;
      } else if (character === '"' || character === "'" || character === "`") {
        quote = character;
      } else if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth = Math.max(0, depth - 1);
      } else if (character === "<" && depth > 0 && /[A-Za-z]/.test(source[index + 1] ?? "")) {
        ownParts.push(source.slice(ownStart, index));
        nested.push(...readOpeningTag());
        ownStart = index;
        continue;
      } else if (character === ">" && depth === 0) {
        index += 1;
        ownParts.push(source.slice(ownStart, index));
        return [{ text: source.slice(start, index), ownText: ownParts.join(""), line: startLine }, ...nested];
      }
      index += 1;
    }
    return nested;
  };

  while (index < source.length) {
    if (source[index] === "<" && /[A-Za-z]/.test(source[index + 1] ?? "")) {
      tags.push(...readOpeningTag());
    } else {
      if (source[index] === "\n") line += 1;
      index += 1;
    }
  }

  return tags;
}

export function findAriaStateViolations(file: string, source: string): AriaStateViolation[] {
  const lines = source.split("\n");
  const violations: AriaStateViolation[] = [];
  const add = (line: number, rule: AriaStateViolation["rule"]) => {
    violations.push({ file, line, rule, snippet: (lines[line - 1] ?? "").trim().slice(0, 120) });
  };

  lines.forEach((text, index) => {
    if (text.includes("accessibilityState")) add(index + 1, "R-1");
  });

  for (const tag of findJsxOpeningTags(source)) {
    const role = tag.ownText.match(/\b(?:accessibilityRole|role)\s*=\s*(["'])([^"']*)\1/)?.[2];
    if (tag.ownText.includes("aria-selected") && role !== "tab") add(tag.line, "R-2");
  }

  return violations;
}
