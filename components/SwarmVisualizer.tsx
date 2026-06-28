"use client";

import React from "react";

export interface SwarmNode {
  id: number;
  role: string;
  subtask: string;
  status: "idle" | "running" | "completed" | "failed";
  ttft?: number;
  tps?: number;
  tokens?: number;
  output?: string;
}

export interface SwarmState {
  stage: "idle" | "planning" | "researching" | "swarm" | "synthesizing" | "critiquing" | "done" | "failed";
  nodes: SwarmNode[];
  researchFacts?: string;
  refinementRounds: number;
  criticFeedback?: string;
  logs: string[];
}

interface SwarmVisualizerProps {
  state: SwarmState;
}

export const SwarmVisualizer: React.FC<SwarmVisualizerProps> = ({ state }) => {
  const getStageColor = (stageName: string, activeStage: string) => {
    if (activeStage === "failed") return "border-red-500 text-red-400";
    if (activeStage === "done") return "border-emerald-500 text-emerald-400";
    if (activeStage === stageName) return "border-indigo-500 text-indigo-400 animate-pulse";
    const stagesOrder = ["planning", "researching", "swarm", "synthesizing", "critiquing", "done"];
    const activeIdx = stagesOrder.indexOf(activeStage);
    const stageIdx = stagesOrder.indexOf(stageName);
    if (activeIdx > stageIdx) return "border-emerald-500/50 text-emerald-500/80";
    return "border-zinc-800 text-zinc-500";
  };

  return (
    <div className="glass p-5 rounded-xl flex flex-col h-[650px]">
      <h3 className="font-bold text-white mb-4 flex items-center justify-between">
        <span>⚡ Swarm Engine Telemetry & Visualizer</span>
        <span className="text-[10px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700 font-mono">
          Core Pipeline
        </span>
      </h3>

      {/* Pipeline Progress */}
      <div className="grid grid-cols-5 gap-2 mb-6">
        {[
          { name: "planning", label: "1. Planner" },
          { name: "researching", label: "2. Researcher" },
          { name: "swarm", label: "3. Parallel Nodes" },
          { name: "synthesizing", label: "4. Synthesizer" },
          { name: "critiquing", label: "5. Critic Loop" },
        ].map((item) => (
          <div
            key={item.name}
            className={`text-center py-2 px-1 border-b-2 font-medium text-xs transition-all ${getStageColor(
              item.name,
              state.stage
            )}`}
          >
            {item.label}
          </div>
        ))}
      </div>

      {/* Visual Representation Area */}
      <div className="flex-1 overflow-y-auto mb-4 border border-zinc-900 bg-zinc-950/60 p-4 rounded-lg">
        {state.stage === "idle" && (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-2">
            <span className="text-3xl">🤖</span>
            <p className="text-sm">Awaiting task initialization to spin up the swarm...</p>
          </div>
        )}

        {state.stage === "planning" && (
          <div className="flex flex-col items-center justify-center h-full text-indigo-400 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            <p className="text-sm font-mono text-zinc-400">Gemma 4 31B: Deconstructing objective into parallel plan...</p>
          </div>
        )}

        {state.stage === "researching" && (
          <div className="flex flex-col justify-center h-full gap-4 max-w-lg mx-auto">
            <div className="flex items-center gap-3 text-indigo-400">
              <div className="animate-pulse h-4 w-4 rounded-full bg-indigo-500" />
              <p className="text-sm font-mono font-bold">DuckDuckGo ToolBox Search: Querying live web facts...</p>
            </div>
            {state.researchFacts && (
              <div className="bg-zinc-900/90 border border-zinc-800 p-3 rounded-lg text-xs font-mono text-zinc-300 max-h-48 overflow-y-auto">
                <div className="text-indigo-400 font-semibold mb-1">Grounding Facts Extracted:</div>
                {state.researchFacts}
              </div>
            )}
          </div>
        )}

        {(state.stage === "swarm" || state.stage === "synthesizing" || state.stage === "critiquing" || state.stage === "done" || state.stage === "failed") && (
          <div className="flex flex-col h-full gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {state.nodes.map((node) => {
                const isRunning = node.status === "running";
                const isDone = node.status === "completed";
                const isFailed = node.status === "failed";

                return (
                  <div
                    key={node.id}
                    className={`p-3 rounded-lg border transition-all ${
                      isRunning
                        ? "border-indigo-500/50 bg-indigo-950/10 shadow-[0_0_15px_rgba(99,102,241,0.1)]"
                        : isDone
                        ? "border-emerald-950 bg-emerald-950/5"
                        : isFailed
                        ? "border-red-950 bg-red-950/5"
                        : "border-zinc-850 bg-zinc-900/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-zinc-300 font-mono">
                        Node {node.id}: {node.role}
                      </span>
                      <span
                        className={`text-[8px] uppercase tracking-wider px-1 rounded font-bold ${
                          isRunning
                            ? "bg-indigo-500/20 text-indigo-400 animate-pulse"
                            : isDone
                            ? "bg-emerald-500/20 text-emerald-400"
                            : isFailed
                            ? "bg-red-500/20 text-red-400"
                            : "bg-zinc-800 text-zinc-500"
                        }`}
                      >
                        {node.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 line-clamp-2 h-7 mb-2 border-b border-zinc-800/40 pb-2">
                      {node.subtask}
                    </p>
                    {isDone && (
                      <div className="grid grid-cols-2 gap-1 text-[9px] text-zinc-500 font-mono pt-1">
                        <div>TTFT: {node.ttft}ms</div>
                        <div>Speed: {node.tps?.toFixed(0)}/s</div>
                        <div className="col-span-2">Tokens: {node.tokens}</div>
                      </div>
                    )}
                    {isRunning && (
                      <div className="flex items-center justify-center py-2">
                        <span className="text-[9px] text-indigo-400 font-mono animate-pulse-subtle">
                          Generating Insights...
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Critique panel */}
            {state.stage === "critiquing" && (
              <div className="mt-auto border border-amber-500/20 bg-amber-950/5 p-3 rounded-lg text-xs font-mono">
                <div className="flex items-center justify-between text-amber-400 font-bold mb-1">
                  <span>🔁 Critic-Refiner Loop Evaluation:</span>
                  <span>Rounds: {state.refinementRounds}/3</span>
                </div>
                <p className="text-zinc-300 max-h-24 overflow-y-auto leading-relaxed">
                  {state.criticFeedback || "Evaluating aggregated draft quality against requirements..."}
                </p>
              </div>
            )}

            {state.stage === "synthesizing" && (
              <div className="mt-auto border border-zinc-800 bg-zinc-900/20 p-3 rounded-lg text-xs font-mono">
                <div className="text-indigo-400 font-bold mb-1">Synthesizing Master Response:</div>
                <p className="text-zinc-400 animate-pulse-subtle">
                  Fusing parallel swarm insights into a unified, high-integrity delivery...
                </p>
              </div>
            )}

            {state.stage === "done" && (
              <div className="mt-auto border border-emerald-500/20 bg-emerald-950/5 p-3 rounded-lg text-xs font-mono">
                <div className="text-emerald-400 font-bold mb-1">✓ Execution Complete:</div>
                <p className="text-zinc-300">
                  Insights successfully aggregated and polished. Extracted VM sandbox code and live HTML render.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Terminal Telemetry log console */}
      <div className="h-32 bg-black/60 border border-zinc-900 rounded-lg p-2 overflow-y-auto text-[10px] font-mono text-zinc-400 leading-normal">
        {state.logs.length === 0 ? (
          <span className="text-zinc-600">// Telemetry trace logs will display here...</span>
        ) : (
          state.logs.map((log, idx) => <div key={idx}>{log}</div>)
        )}
      </div>
    </div>
  );
};
