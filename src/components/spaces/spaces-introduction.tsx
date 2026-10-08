import { Compass, Globe, Database, Layers, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SpacesIntroduction({ onCreate }: { onCreate: () => void }) {
  const steps = [
    {
      title: "Your vision",
      description: "What you want to explore",
      Icon: Compass,
      className: "vision",
    },
    {
      title: "Web research",
      description: "Find possibilities and answers",
      Icon: Globe,
      className: "research",
    },
    {
      title: "Your context",
      description: "Bring in your data and preferences",
      Icon: Database,
      className: "context",
    },
    {
      title: "A clear plan",
      description: "Connect the findings and decide",
      Icon: Layers,
      className: "plan",
    },
  ];
  return (
    <section className="spaces-introduction">
      <div className="spaces-introduction-copy">
        <h2 className="text-3xl font-medium tracking-tight">
          Start with your vision.
        </h2>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Explore a decision with agents that research in parallel, build on
          each other’s findings, and bring everything into a plan.
        </p>
        <Button onClick={onCreate} className="mt-6 gap-2">
          <Plus className="size-4" />
          Create a space
        </Button>
      </div>
      <div className="spaces-introduction-preview">
        <div
          className="spaces-introduction-graph"
          aria-label="Your vision branches into web research and your context, then joins into a plan"
        >
          <svg
            className="spaces-introduction-edges text-border"
            viewBox="0 0 660 392"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <marker
                id="spaces-intro-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
            </defs>
            <path d="M 188 196 L 236 60 M 188 196 L 236 332 M 424 60 L 472 196 M 424 332 L 472 196" />
          </svg>
          {steps.map(({ title, description, Icon, className }) => (
            <div
              key={title}
              className={`spaces-introduction-node ${className}`}
            >
              <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
                <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="text-xs font-medium">{title}</span>
              </div>
              <p className="px-3 py-3 text-xs leading-relaxed text-muted-foreground">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
