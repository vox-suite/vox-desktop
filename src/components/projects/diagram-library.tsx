import { ArrowRight, Layers, Trash2 } from "lucide-react";
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
  onDeleteDraft,
  onDelete,
  onAsk,
}: {
  messages: ProjectMessage[];
  draft: { flow: ProjectFlow; question: string } | null;
  busy: boolean;
  onOpen: (id: string) => void;
  onDraft: () => void;
  onDeleteDraft: () => void;
  onDelete: (message: ProjectMessage) => void;
  onAsk: (question: string) => void;
}) {
  const diagrams = latestDiagrams(messages);
  return (
    <section
      className="project-diagram-library"
      aria-labelledby="diagram-library-title"
    >
      {(diagrams.length > 0 || draft) && (
        <header className="project-diagram-library-heading">
          <div>
            <h2 id="diagram-library-title">Diagrams</h2>
            <p>
              {diagrams.length
                ? `${diagrams.length} saved ${diagrams.length === 1 ? "diagram" : "diagrams"}`
                : "Review your draft, then save it to this project."}
            </p>
          </div>
        </header>
      )}
      {draft && (
        <div className="project-diagram-draft-row">
          <div>
            <span className="project-draft-badge">Unsaved draft</span>
            <h3>{draft.flow.title}</h3>
            <p>{draft.question}</p>
          </div>
          <div className="project-diagram-draft-actions">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={onDraft}
            >
              Review draft <ArrowRight className="size-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={onDeleteDraft}
              aria-label={`Delete draft ${draft.flow.title}`}
            >
              <Trash2 className="size-3.5" /> Delete
            </Button>
          </div>
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
            <svg
              className="project-diagram-empty-art"
              viewBox="0 0 240 112"
              aria-hidden="true"
              focusable="false"
            >
              <g fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M62 56h34m48 0h34M120 32V16h58v20M120 80v16H62V76" />
                <rect x="18" y="36" width="44" height="40" rx="8" />
                <rect x="178" y="36" width="44" height="40" rx="8" />
                <rect
                  x="96"
                  y="32"
                  width="48"
                  height="48"
                  rx="10"
                  className="project-diagram-empty-focus"
                />
                <path
                  d="m112 56 6 6 11-12"
                  className="project-diagram-empty-check"
                />
              </g>
            </svg>
            <h2 id="diagram-library-title">Understand your project</h2>
            <p>
              Ask how something works. Vox traces your sources into a diagram.
            </p>
            <button
              className="project-diagram-example"
              disabled={busy}
              onClick={() =>
                onAsk("How does a request move through this project?")
              }
            >
              Try “How does a request move through this project?”{" "}
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        )
      )}
    </section>
  );
}
