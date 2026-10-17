import { useEffect, useRef } from "react";
import { ArrowUp, Folder, Loader2, ShieldCheck, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function describeStatus(status: string) {
  const tool = status.match(/^Investigating: ([^ ·]+)(?: · (.*))?/);
  if (!tool) return status;
  const labels: Record<string, string> = {
    list_sources: "Checking project sources…",
    list_files: "Finding relevant files…",
    search_symbols: "Finding connected components…",
    search_text: "Searching the code…",
    graph_calls: "Tracing calls between components…",
    read_source: "Reading the implementation…",
    diagram_capabilities: "Considering the useful building blocks…",
    diagram_schema: "Preparing the diagram structure…",
    preview_diagram: "Checking the diagram layout…",
    submit_diagram: "Checking the diagram and its references…",
  };
  return labels[tool[1]] ?? "Tracing the implementation…";
}

export function InvestigationComposer({
  question,
  onChange,
  onSubmit,
  onSources,
  onStop,
  status,
  log,
  thinking,
  disabled,
  sourceCount,
}: {
  question: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSources: () => void;
  onStop: () => void;
  status: string;
  log: string[];
  thinking: string;
  disabled: boolean;
  sourceCount: number;
}) {
  const stream = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    stream.current?.scrollTo({ top: stream.current.scrollHeight });
  }, [thinking]);
  return (
    <div className="project-composer-dock">
      <form
        className="project-build-composer"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <label htmlFor="project-question" className="sr-only">
          Ask about your project
        </label>
        <Textarea
          id="project-question"
          name="question"
          placeholder="Ask a question or describe a diagram."
          value={question}
          maxLength={12000}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          disabled={!!status}
        />
        <div className="project-composer-actions">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!!status}
            onClick={onSources}
          >
            <Folder className="size-3.5" />
            {sourceCount
              ? `${sourceCount} ${sourceCount === 1 ? "source" : "sources"}`
              : "Add sources"}
          </Button>
          <span
            className="project-excerpt-note"
            title="Relevant source excerpts are sent to the model to trace your question. Full files and the index stay on this device."
          >
            <ShieldCheck className="size-3.5" /> Files stay local
          </span>
          {status ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={onStop}
            >
              <Square className="size-3" />
              Stop
            </Button>
          ) : (
            <Button
              type="submit"
              size="sm"
              disabled={disabled || !question.trim()}
            >
              <ArrowUp className="size-3.5" />
              Draw diagram
            </Button>
          )}
        </div>
        {(status || log.length > 0) && (
          <details className="project-investigation">
            <summary>
              {status ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <span className="project-status-dot" />
              )}
              <span
                role="status"
                className={status ? "project-thinking" : undefined}
              >
                {status ? describeStatus(status) : "Recent investigation"}
              </span>
              <span className="project-investigation-detail">
                View activity
              </span>
            </summary>
            <ol>
              {log.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          </details>
        )}
        {thinking && (
          <details className="project-explanation">
            <summary>Diagram explanation</summary>
          <p ref={stream} className="project-thinking-stream">
            {thinking}
            {status && <span className="project-thinking-caret" />}
          </p>
          </details>
        )}
      </form>
    </div>
  );
}
