"use client";

import React from "react";

export interface TelemetryMetrics {
  ttft: number; // in ms
  tps: number;  // tokens per second
  totalTokens: number;
  loading: boolean;
  active: boolean;
}

interface SpeedHUDProps {
  cerebras: TelemetryMetrics;
  gpu: TelemetryMetrics;
}

export const SpeedHUD: React.FC<SpeedHUDProps> = ({ cerebras, gpu }) => {
  // Only show a speedup when BOTH sides were actually measured. No fabrication.
  const hasRace = cerebras.tps > 0 && gpu.tps > 0;
  const speedup = hasRace ? (cerebras.tps / gpu.tps).toFixed(1) : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Cerebras Card */}
      <div className="glass-indigo glow-indigo p-4 rounded-xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300 hover:scale-[1.01]">
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all duration-500" />
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold tracking-wider text-indigo-400 uppercase">Engine A (Primary)</span>
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75 ${cerebras.loading ? "block" : "hidden"}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${cerebras.loading ? "bg-indigo-400" : cerebras.active ? "bg-emerald-500" : "bg-zinc-600"}`}></span>
            </span>
          </div>
          <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
            Cerebras Cloud <span className="text-xs bg-indigo-500/25 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">Gemma 4 31B</span>
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-zinc-800">
          <div>
            <div className="text-2xl font-extrabold text-white font-mono">
              {cerebras.loading ? "..." : cerebras.active ? `${cerebras.ttft}ms` : "0ms"}
            </div>
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">TTFT</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-indigo-400 font-mono">
              {cerebras.loading ? (
                <span className="inline-block animate-pulse-subtle">Stream</span>
              ) : cerebras.active ? (
                `${cerebras.tps.toFixed(0)}/s`
              ) : (
                "0/s"
              )}
            </div>
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Tokens/sec</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-white font-mono">
              {cerebras.loading ? "..." : cerebras.active ? cerebras.totalTokens : 0}
            </div>
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Total Tok</div>
          </div>
        </div>
      </div>

      {/* Baseline GPU Card */}
      <div className="glass p-4 rounded-xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300 hover:scale-[1.01]">
        <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl" />
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">Baseline Provider</span>
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 ${gpu.loading ? "block" : "hidden"}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${gpu.loading ? "bg-red-400" : gpu.active ? "bg-amber-500" : "bg-zinc-700"}`}></span>
            </span>
          </div>
          <h3 className="text-lg font-bold text-zinc-300">
            Standard GPU Node <span className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700">A100-80G</span>
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-zinc-800/60">
          <div>
            <div className="text-2xl font-extrabold text-zinc-400 font-mono">
              {gpu.loading ? "..." : gpu.active ? `${gpu.ttft}ms` : "0ms"}
            </div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">TTFT</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-zinc-500 font-mono">
              {gpu.loading ? (
                <span className="inline-block animate-pulse-subtle">Stream</span>
              ) : gpu.active ? (
                `${gpu.tps.toFixed(0)}/s`
              ) : (
                "0/s"
              )}
            </div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Tokens/sec</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-zinc-400 font-mono">
              {gpu.loading ? "..." : gpu.active ? gpu.totalTokens : 0}
            </div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Total Tok</div>
          </div>
        </div>
      </div>

      {/* Speedup Ratio Card */}
      <div className="glass glow-emerald p-4 rounded-xl flex flex-col justify-between relative overflow-hidden group transition-all duration-300 hover:scale-[1.01] border-emerald-500/20 bg-emerald-950/5">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
        <div>
          <span className="text-xs font-semibold tracking-wider text-emerald-400 uppercase">Performance Delta</span>
          <h3 className="text-lg font-bold text-white mt-1">Cerebras Acceleration</h3>
        </div>
        <div className="mt-4 pt-4 border-t border-zinc-800 flex items-baseline gap-2">
          {hasRace ? (
            <>
              <span className="text-4xl font-extrabold text-emerald-400 font-mono">{speedup}x</span>
              <span className="text-sm text-emerald-500 font-medium">Faster tokens/sec (measured)</span>
            </>
          ) : (
            <span className="text-xs text-zinc-500 leading-snug">
              Add a GPU baseline key to run a live, measured Cerebras-vs-GPU race.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
