import { ArrowUp, Folder, ShieldCheck, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function InvestigationComposer({
  question,
  onChange,
  onSubmit,
  onSources,
  onStop,
  status,
  disabled,
  sourceCount,
  editingDiagram = false,
}: {
  question: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSources: () => void;
  onStop: () => void;
  status: string;
  disabled: boolean;
  sourceCount: number;
  editingDiagram?: boolean;
}) {
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
          placeholder={
            editingDiagram
              ? "Describe what to add or change…"
              : "What would you like to understand about this project?"
          }
          value={question}
          maxLength={12000}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
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
              {editingDiagram ? "Update diagram" : "Draw diagram"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
