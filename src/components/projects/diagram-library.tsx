import { ArrowRight, FileText, Layers, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  diagramKinds,
  diagramLineage,
  latestDiagrams,
} from "@/features/projects/diagrams";
import type { ProjectFlow, ProjectMessage } from "@/features/projects/types";

export function DiagramLibrary({
  messages,
  draft,
  busy,
  onOpen,
  onDraft,
  onDelete,
  onContext,
}: {
  messages: ProjectMessage[];
  draft: { flow: ProjectFlow; question: string } | null;
  busy: boolean;
  onOpen: (id: string) => void;
  onDraft: () => void;
  onDelete: (message: ProjectMessage) => void;
  onContext: () => void;
}) {
  const diagrams = latestDiagrams(messages);
  return (
    <section
      className="project-diagram-library"
      aria-labelledby="diagram-library-title"
    >
      <header className="project-diagram-library-heading">
        <div>
          <h2 id="diagram-library-title">Diagrams</h2>
          <p>
            {diagrams.length
              ? `${diagrams.length} saved ${diagrams.length === 1 ? "diagram" : "diagrams"}. Open one to explore its canvas.`
              : "Ask about your project below to draw your first diagram."}
          </p>
        </div>
        <Button variant="ghost" size="sm" disabled={busy} onClick={onContext}>
          <FileText className="size-3.5" /> Project context
        </Button>
      </header>
      {draft && (
        <div className="project-diagram-draft-row">
          <div>
            <span className="project-draft-badge">Unsaved draft</span>
            <h3>{draft.flow.title}</h3>
            <p>{draft.question}</p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={onDraft}
          >
            Review draft <ArrowRight className="size-3.5" />
          </Button>
        </div>
      )}
      {diagrams.length ? (
        <ul className="project-diagram-list" aria-label="Saved diagrams">
          {diagrams.map((message) => {
            const flow = message.flow!;
            const versions = messages.filter(
              (m) =>
                m.role === "assistant" &&
                m.flow?.diagram &&
                diagramLineage(m) === diagramLineage(message),
            ).length;
            return (
              <li key={message.id}>
                <button
                  className="project-diagram-open"
                  disabled={busy}
                  onClick={() => onOpen(message.id)}
                  aria-label={`Open diagram ${flow.title}`}
                >
                  <span className="project-diagram-list-icon">
                    <Layers className="size-4" />
                  </span>
                  <span className="project-diagram-list-copy">
                    <strong>{flow.title}</strong>
                    <span>
                      {diagramKinds[flow.diagram!.diagram_type]} ·{" "}
                      {flow.nodes.length} elements
                      {versions > 1 ? ` · ${versions} versions` : ""}
                    </span>
                  </span>
                  <time dateTime={message.at}>
                    {new Date(message.at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                  <ArrowRight className="project-diagram-open-arrow size-4" />
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={busy}
                  aria-label={`Delete diagram ${flow.title}`}
                  onClick={() => onDelete(message)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        !draft && (
          <div className="project-diagram-library-empty">
            <Layers className="size-7" aria-hidden="true" />
            <h3>No saved diagrams yet</h3>
            <p>
              Trace a flow, review the diagram, then save it here with a title.
            </p>
          </div>
        )
      )}
    </section>
  );
}
