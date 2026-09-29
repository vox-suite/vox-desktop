import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  Plus,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useChartBoards } from "@/hooks/use-chart-boards";
import { BoardView } from "@/components/pulse/board-view";
import { CreateBoardFlow } from "@/components/pulse/create-board-flow";

export function PulseView() {
  const { boards, loading, error, reload } = useChartBoards();
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [showCreateFlow, setShowCreateFlow] = useState(false);

  if (selectedBoardId) {
    return (
      <BoardView
        boardId={selectedBoardId}
        onBack={() => {
          setSelectedBoardId(null);
          void reload();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-[#0b0c0e] p-6 text-zinc-100">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-sky-400" />
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">
              Pulse Analytics
            </h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Revisitable visual boards and pattern analytics from your tracked categories
          </p>
        </div>

        <Button
          onClick={() => setShowCreateFlow(true)}
          className="bg-sky-500 text-black hover:bg-sky-400 gap-1.5 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>New Board</span>
        </Button>
      </div>

      {loading && boards.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-20 text-zinc-500">
          <RotateCw className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center py-20 text-center text-red-400">
          <AlertTriangle className="h-8 w-8 mb-2" />
          <p className="text-sm font-semibold">Failed to load boards</p>
          <p className="text-xs text-zinc-500 mt-1">{error}</p>
        </div>
      ) : boards.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 mb-4 shadow-inner">
            <Activity className="h-7 w-7 text-sky-400" />
          </div>
          <h2 className="text-base font-semibold text-zinc-200">
            No boards yet
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm">
            Create your first Pulse board to get AI-suggested charts tailored to
            your real data shapes and categories.
          </p>
          <Button
            onClick={() => setShowCreateFlow(true)}
            className="mt-5 bg-sky-500 text-black hover:bg-sky-400 gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Create Board</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map((board) => {
            const count = board.chart_count ?? board.charts?.length ?? 0;

            return (
              <Card
                key={board.id}
                onClick={() => setSelectedBoardId(board.id)}
                className="group flex flex-col justify-between cursor-pointer border border-zinc-800/80 bg-[#121316] p-5 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-900/60 shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-sky-300 transition-colors">
                      {board.name}
                    </h3>
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 group-hover:bg-sky-500 group-hover:text-black transition-all">
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-zinc-800/60 pt-3 text-xs text-zinc-500">
                  <div className="flex items-center gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5 text-zinc-400" />
                    <span>
                      {count} {count === 1 ? "chart" : "charts"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {new Date(board.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showCreateFlow && (
        <CreateBoardFlow
          onClose={() => setShowCreateFlow(false)}
          onCreated={(boardId) => {
            setShowCreateFlow(false);
            void reload();
            setSelectedBoardId(boardId);
          }}
        />
      )}
    </div>
  );
}
