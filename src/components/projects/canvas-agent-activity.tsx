import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

function readableStatus(status: string) {
  const tool = status.match(/^Investigating: ([^ ·]+)(?: · (.*))?/);
  if (!tool) return status;
  const labels: Record<string, string> = {
    plan_request: "Planning the investigation…",
    list_sources: "Checking project sources…",
    current_diagram: "Reading the current diagram…",
    list_files: "Finding relevant files…",
    search_symbols: "Finding connected components…",
    search_text: "Searching the code…",
    graph_calls: "Tracing calls…",
    read_source: "Reading the implementation…",
    diagram_capabilities: "Choosing the diagram structure…",
    diagram_schema: "Preparing the diagram…",
    preview_diagram: "Checking the layout…",
    submit_diagram: "Verifying the changes…",
  };
  return labels[tool[1]] ?? "Investigating the sources…";
}

const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const randomWords = (length: number) => {
  let out = "";
  while (out.length < length) {
    const word = 3 + Math.floor(Math.random() * 7);
    out += (out ? " " : "") + Array.from({ length: word }, () => "x").join("");
  }
  return out.slice(0, length).trimEnd();
};

// A step not decided yet: a sentence-shaped run of letters that keep
// changing. Word gaps stay put so it still reads as a sentence.
function UndecidedLine({ length }: { length: number }) {
  const [shape] = useState(() => randomWords(length));
  const scramble = () =>
    shape.replace(
      /x/g,
      () => LETTERS[Math.floor(Math.random() * LETTERS.length)],
    );
  const [text, setText] = useState(scramble);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setText(scramble()), 90);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <span>{text}</span>;
}

// Consecutive repeats collapse into one line with a count.
function collapse(lines: string[]) {
  const out: { text: string; count: number }[] = [];
  for (const line of lines) {
    const last = out.at(-1);
    if (last?.text === line) last.count++;
    else out.push({ text: line, count: 1 });
  }
  return out;
}

const REEL_ABOVE = 4;
const REEL_BELOW = 3;

export function CanvasAgentActivity({
  status,
  response,
  activity,
  centered = false,
}: {
  status: string;
  response: string;
  activity: string[];
  centered?: boolean;
}) {
  const stream = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = stream.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [response, activity]);
  if (!status && !response) return null;

  if (centered && status) {
    const lines = collapse(
      [...activity, status].map(readableStatus).filter(Boolean),
    );
    const current = lines.length - 1;
    const shown = lines.slice(-REEL_ABOVE - 1);
    return (
      <aside
        className="project-agent-reel"
        aria-label="Agent activity"
        data-active
      >
        <span role="status" className="sr-only">
          {lines[current]?.text}
        </span>
        <ol aria-hidden="true">
          {shown.map((line, i) => {
            const distance = shown.length - 1 - i;
            return (
              <li key={current - distance} data-distance={distance}>
                {distance === 0 && (
                  <Loader2 className="size-[0.8em] animate-spin" />
                )}
                {line.text}
                {line.count > 1 && <small>×{line.count}</small>}
              </li>
            );
          })}
          {Array.from({ length: REEL_BELOW }, (_, i) => (
            <li key={`next${i}`} data-distance={i + 1} data-pending>
              <UndecidedLine length={[34, 30, 26][i]} />
            </li>
          ))}
        </ol>
      </aside>
    );
  }

  return (
    <aside
      className="project-agent-activity"
      aria-label="Agent activity"
      data-active={!!status}
    >
      <header>
        <span role="status">
          {status && (
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          )}
          {status ? readableStatus(status) : "Agent response"}
        </span>
      </header>
      <div ref={stream} className="project-agent-response" aria-live="off">
        {response ? (
          <p>{response}</p>
        ) : (
          activity
            .slice(-2)
            .map((line, index) => <p key={index}>{readableStatus(line)}</p>)
        )}
      </div>
    </aside>
  );
}
