import { useEffect, useRef } from "react";
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

export function CanvasAgentActivity({
  status,
  response,
  activity,
}: {
  status: string;
  response: string;
  activity: string[];
}) {
  const stream = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = stream.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [response, activity]);
  if (!status && !response) return null;
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
