import type { DiagramIR } from "./types";

const fence = /```(?:json)?\s*(?=\{)/g;

// Cut after the last fully closed inner object/array, close what is still open, and parse.
export function partialJson(
  source: string,
): { value: unknown; cut: number } | null {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let cut = -1;
  let open: string[] = [];
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "{" || c === "[") stack.push(c);
    else if (c === "}" || c === "]") {
      stack.pop();
      if (!stack.length) {
        try {
          return { value: JSON.parse(source.slice(0, i + 1)), cut: i + 1 };
        } catch {
          return null;
        }
      }
      cut = i + 1;
      open = [...stack];
    }
  }
  if (cut < 0) return null;
  const closing = open
    .reverse()
    .map((c) => (c === "{" ? "}" : "]"))
    .join("");
  try {
    return { value: JSON.parse(source.slice(0, cut) + closing), cut };
  } catch {
    return null;
  }
}

// The diagram the model is currently writing in its latest ```json block.
export function streamingDiagram(
  text: string,
): { diagram: DiagramIR; cut: number } | null {
  const start = [...text.matchAll(fence)].at(-1);
  if (start?.index === undefined) return null;
  const body = text.slice(start.index + start[0].length);
  const parsed = partialJson(body);
  const diagram = parsed?.value as DiagramIR | undefined;
  if (!diagram || typeof diagram !== "object" || !diagram.diagram_type)
    return null;
  return { diagram, cut: start.index + parsed!.cut };
}

export function withoutDiagrams(text: string) {
  return text.replace(/```(?:json)?\s*\{[\s\S]*?(?:```|$)/g, "").trim();
}

if (import.meta.env?.DEV) {
  const a = partialJson('{"t":"x","nodes":[{"id":"a"},{"id":"b","la');
  console.assert(
    JSON.stringify(a?.value) === '{"t":"x","nodes":[{"id":"a"}]}',
    "partialJson cut",
  );
  const b = partialJson('{"s":"}{[","n":[{"id":"\\"}"}]}');
  console.assert(
    JSON.stringify(b?.value) === '{"s":"}{[","n":[{"id":"\\"}"}]}',
    "partialJson strings",
  );
}
