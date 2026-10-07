import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function PulseChartSkeleton() {
  return (
    <Card className="pulse-chart h-full" aria-hidden="true">
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-4">
        <Skeleton className="h-8 w-8 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-44" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <div className="pulse-chart-body space-y-4">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-8 w-28" />
      </div>
    </Card>
  );
}
