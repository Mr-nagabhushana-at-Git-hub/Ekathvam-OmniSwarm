"use client";

import React from "react";

/**
 * "Cerebras Advantage" — the marketing comparison that advertises wafer-scale
 * speed over GPU-based LLM inference, kept HONEST:
 *   - Cerebras is the REAL number measured live from the run (● measured).
 *   - GPU rows are clearly-labelled published/typical single-stream baselines
 *     (○ reference), never presented as live measurements.
 * The multiplier is computed from the measured Cerebras throughput.
 */

interface Props {
  cerebrasTps: number; // measured tokens/sec from the live run (0 before a run)
  measured: boolean;
}

// Typical single-stream decode throughput (tokens/sec) for GPU-hosted LLMs.
// Reference figures for advertising context — not live measurements.
const GPU_BASELINES = [
  { name: "Local GPU · RTX 4090 (consumer)", tps: 55, note: "llama.cpp, 7–13B class" },
  { name: "Datacenter GPU · A100 80G (hosted)", tps: 110, note: "single-stream decode" },
];

// Published headline for Gemma 4 31B on Cerebras, shown before a live run.
const CEREBRAS_PUBLISHED_TPS = 1500;

export const CerebrasAdvantage: React.FC<Props> = ({ cerebrasTps, measured }) => {
  const cerebras = measured && cerebrasTps > 0 ? cerebrasTps : CEREBRAS_PUBLISHED_TPS;
  const max = Math.max(cerebras, ...GPU_BASELINES.map((b) => b.tps));

  const rows = [
    {
      name: "Cerebras · Gemma 4 31B",
      tps: cerebras,
      color: "bg-indigo-500",
      text: "text-indigo-300",
      tag: measured && cerebrasTps > 0 ? "● measured live" : "○ published — run to measure",
      tagColor: measured && cerebrasTps > 0 ? "text-emerald-400" : "text-zinc-500",
      hero: true,
    },
    ...GPU_BASELINES.map((b) => ({
      name: b.name,
      tps: b.tps,
      color: "bg-zinc-600",
      text: "text-zinc-400",
      tag: `○ reference · ${b.note}`,
      tagColor: "text-zinc-600",
      hero: false,
    })),
  ];

  return (
    <div className="glass glow-indigo rounded-xl p-5 mt-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">Cerebras Advantage vs GPU inference</h3>
          <p className="text-[11px] text-zinc-500 font-mono">single-stream output tokens/sec — higher is better</p>
        </div>
        <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">Wafer-scale</span>
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((r) => {
          const pct = Math.max(2, (r.tps / max) * 100);
          const multiplier = !r.hero && r.tps > 0 ? cerebras / r.tps : 0;
          return (
            <div key={r.name}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={`font-medium ${r.hero ? "text-white" : "text-zinc-400"}`}>{r.name}</span>
                <span className="flex items-baseline gap-2">
                  <span className={`font-mono font-bold ${r.text}`}>{Math.round(r.tps).toLocaleString()} t/s</span>
                  {multiplier >= 2 && (
                    <span className="font-mono text-[10px] text-emerald-400">{Math.round(multiplier)}× slower</span>
                  )}
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-zinc-900 overflow-hidden">
                <div
                  className={`h-full rounded-full ${r.color} transition-all duration-700`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className={`text-[10px] font-mono mt-0.5 ${r.tagColor}`}>{r.tag}</div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-zinc-600 mt-4 leading-snug border-t border-zinc-850 pt-3">
        Cerebras' edge is single-stream / per-user latency — exactly what interactive multi-agent swarms need. GPU rows are
        typical published single-stream figures, not live measurements; batched datacenter GPUs can reach high aggregate
        throughput at scale. The Cerebras bar turns to a live measurement the moment you run the swarm.
      </p>
    </div>
  );
};
