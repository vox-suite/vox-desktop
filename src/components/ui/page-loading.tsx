import { alpha, token, type VoxColor } from "@/lib/theme";
import { cn } from "@/lib/utils";

const PLATES = [54, 42, 30];

export function PageLoading({
  label = "Loading…",
  accent,
  className,
}: {
  label?: string;
  accent: VoxColor;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 p-8",
        className,
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 80 80"
        className="size-16"
        strokeWidth="1"
        strokeLinejoin="round"
      >
        {PLATES.map((y, i) => (
          <g key={y} transform={`translate(40 ${y})`}>
            <g
              className="page-loading-plate"
              style={{
                animationDelay: `${i * 0.18}s`,
                stroke: i === 2 ? token(accent) : alpha("ink", 55),
                fill: token("surface"),
              }}
            >
              <path d="M-22,0 L0,11 L22,0 L22,4 L0,15 L-22,4 Z" />
              <path d="M0,-11 L22,0 L0,11 L-22,0 Z" />
              {i === 2 && (
                <path
                  d="M0,-11 L22,0 L0,11 L-22,0 Z"
                  style={{ fill: alpha(accent, 10) }}
                />
              )}
            </g>
          </g>
        ))}
      </svg>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
