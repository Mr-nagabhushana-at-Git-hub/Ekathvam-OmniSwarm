"use client";

import React, { useState } from "react";
import { SpeedHUD, TelemetryMetrics } from "../components/SpeedHUD";
import { CerebrasAdvantage } from "../components/CerebrasAdvantage";
import { PrivacyManager } from "../components/PrivacyManager";
import { SwarmVisualizer, SwarmState, SwarmNode } from "../components/SwarmVisualizer";
import { Console } from "../components/Console";
import ArtifactExporter from "../components/ArtifactExporter";
import WorkspaceManager from "../components/WorkspaceManager";
import PluginAddonManager from "../components/PluginAddonManager";

export default function Dashboard() {
  // Key & settings state
  const [provider, setProvider] = useState("Cerebras");
  const [model, setModel] = useState("gemma-4-31b");
  const [apiKey, setApiKey] = useState("");
  const [encryptPayload, setEncryptPayload] = useState(false);
  const [useTools, setUseTools] = useState(true);

  // Optional GPU baseline for a real, measured Cerebras-vs-GPU speed race.
  const [baselineKey, setBaselineKey] = useState("");
  const [baselineProvider, setBaselineProvider] = useState("OpenAI");

  // User input
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  // Swarm Pipeline State
  const [swarmState, setSwarmState] = useState<SwarmState>({
    stage: "idle",
    nodes: [],
    researchFacts: "",
    refinementRounds: 0,
    criticFeedback: "",
    logs: [],
  });

  // Telemetry HUD state
  const [cerebrasMetrics, setCerebrasMetrics] = useState<TelemetryMetrics>({
    ttft: 0,
    tps: 0,
    totalTokens: 0,
    active: false,
    loading: false,
  });

  const [gpuMetrics, setGpuMetrics] = useState<TelemetryMetrics>({
    ttft: 0,
    tps: 0,
    totalTokens: 0,
    active: false,
    loading: false,
  });

  // Extracted artifacts
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const [generatedPython, setGeneratedPython] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setSwarmState((prev) => ({
      ...prev,
      logs: [...prev.logs, `[${timestamp}] ${msg}`],
    }));
  };

  const handleClearChat = () => {
    setPrompt("");
    setGeneratedHtml(null);
    setGeneratedPython(null);
    setResponseText("");
    setSwarmState({
      stage: "idle",
      nodes: [],
      researchFacts: "",
      refinementRounds: 0,
      criticFeedback: "",
      logs: ["Environment scrub complete. Local session cleared."],
    });
    setCerebrasMetrics({ ttft: 0, tps: 0, totalTokens: 0, active: false, loading: false });
    setGpuMetrics({ ttft: 0, tps: 0, totalTokens: 0, active: false, loading: false });
  };

  const handleRunSwarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    if (!apiKey) {
      alert(`Please enter your API Key for ${provider} in the Privacy Console.`);
      return;
    }

    setLoading(true);
    setGeneratedHtml(null);
    setGeneratedPython(null);
    setResponseText("");
    
    // Reset swarm state
    setSwarmState({
      stage: "planning",
      nodes: [],
      researchFacts: "",
      refinementRounds: 0,
      criticFeedback: "",
      logs: [],
    });

    addLog("Initializing Twin-Engine Orchestration Core...");
    addLog(`Target Provider: ${provider} | Model: ${model}`);

    // Set Cerebras HUD active. The GPU card only goes "active" when a real
    // baseline key is supplied — we never show a fabricated comparison.
    setCerebrasMetrics({ ttft: 0, tps: 0, totalTokens: 0, active: true, loading: true });
    setGpuMetrics({ ttft: 0, tps: 0, totalTokens: 0, active: !!baselineKey, loading: !!baselineKey });

    try {
      const response = await fetch("/api/swarm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          apiKey,
          provider,
          model,
          useTools,
          baselineApiKey: baselineKey || undefined,
          baselineProvider: baselineKey ? baselineProvider : undefined,
        }),
      });

      if (!response.body) {
        throw new Error("No readable stream body returned from API.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            if (event.type === "error") {
              addLog(`[ERROR] ${event.error}`);
              setSwarmState((prev) => ({ ...prev, stage: "failed" }));
              setCerebrasMetrics((prev) => ({ ...prev, loading: false }));
              setGpuMetrics((prev) => ({ ...prev, loading: false }));
              alert(event.error);
              return;
            }

            if (event.type === "telemetry") {
              setSwarmState((prev) => ({ ...prev, stage: event.stage }));
              addLog(event.logs);
            }

            if (event.type === "metrics") {
              // Real, measured throughput from the actual token stream.
              setCerebrasMetrics({
                ttft: event.cerebras.ttft,
                tps: event.cerebras.tps,
                totalTokens: event.cerebras.totalTokens,
                active: true,
                loading: false,
              });
              if (event.gpu) {
                setGpuMetrics({
                  ttft: event.gpu.ttft,
                  tps: event.gpu.tps,
                  totalTokens: event.gpu.totalTokens,
                  active: true,
                  loading: false,
                });
              } else {
                setGpuMetrics({ ttft: 0, tps: 0, totalTokens: 0, active: false, loading: false });
              }
              addLog(event.logs);
            }

            if (event.type === "plan") {
              setSwarmState((prev) => ({
                ...prev,
                stage: event.stage,
                nodes: event.nodes,
              }));
              addLog(event.logs);
            }

            if (event.type === "research") {
              setSwarmState((prev) => ({
                ...prev,
                stage: event.stage,
                researchFacts: event.researchFacts,
              }));
              addLog(event.logs);
            }

            if (event.type === "node_completed") {
              setSwarmState((prev) => {
                const updatedNodes = prev.nodes.map((n) =>
                  n.id === event.node.id ? event.node : n
                );
                return { ...prev, nodes: updatedNodes };
              });
              addLog(event.logs);
            }

            if (event.type === "done") {
              setSwarmState((prev) => ({
                ...prev,
                stage: "done",
                refinementRounds: event.refinementRounds,
                criticFeedback: event.criticFeedback,
              }));
              addLog(event.logs);

              // Parse final response markdown for HTML/Python blocks
              const rawText = event.finalResponse;
              setResponseText(rawText);

              const htmlMatch = rawText.match(/```html\n([\s\S]*?)```/);
              const pyMatch = rawText.match(/```python\n([\s\S]*?)```/);

              if (htmlMatch) {
                setGeneratedHtml(htmlMatch[1]);
                addLog("Extracted generated HTML artifact for Live Preview.");
              }
              if (pyMatch) {
                setGeneratedPython(pyMatch[1]);
                addLog("Extracted generated Python script for Sandbox VM.");
              }
              // Speed metrics were already set live by the "metrics" event
              // (measured from the real stream) — nothing to hard-code here.
            }
          } catch (jsonErr) {
            console.error("Failed to parse SSE JSON line", jsonErr);
          }
        }
      }
    } catch (err: any) {
      addLog(`[PIPELINE EXCEPTION] ${err?.message || err}`);
      setSwarmState((prev) => ({ ...prev, stage: "failed" }));
    } finally {
      setLoading(false);
    }
  };

  const handleRunPythonProxy = async (code: string): Promise<string> => {
    try {
      const res = await fetch("/api/tools/run-python", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.error) return `[VM Sandbox Error] ${data.error}`;
      return data.stdout || "Execution finished with zero stdout.";
    } catch (e: any) {
      return `[VM Fetch Error] ${e?.message || e}`;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header Banner */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center font-bold text-white shadow-md glow-indigo">
              O
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                OMNISWARM <span className="text-[10px] text-zinc-500 font-mono">v1.0</span>
              </h1>
              <p className="text-[10px] text-indigo-400 font-mono tracking-wider uppercase font-semibold">
                Twin-Engine Multi-Agent Swarm Orchestrator
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Edge Core Online
            </span>
            <span className="text-zinc-700">|</span>
            <a
              href="https://github.com/Mr-nagabhushana-at-Git-hub/Ekathvam-OmniSwarm"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub Repo
            </a>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
        {/* SpeedHUD & Privacy manager */}
        <div>
          <SpeedHUD cerebras={cerebrasMetrics} gpu={gpuMetrics} />
          <CerebrasAdvantage
            cerebrasTps={cerebrasMetrics.tps}
            measured={cerebrasMetrics.active && !cerebrasMetrics.loading && cerebrasMetrics.tps > 0}
          />
          <PrivacyManager
            apiKey={apiKey}
            setApiKey={setApiKey}
            provider={provider}
            setProvider={setProvider}
            encryptPayload={encryptPayload}
            setEncryptPayload={setEncryptPayload}
            onClearChat={handleClearChat}
          />
        </div>

        {/* Agentic Workspace Extensions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <WorkspaceManager />
          <PluginAddonManager />
        </div>

        {/* Input prompt form */}
        <form onSubmit={handleRunSwarm} className="glass p-4 rounded-xl">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Swarm Directive Input
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useTools}
                    onChange={(e) => setUseTools(e.target.checked)}
                    className="rounded bg-zinc-900 border-zinc-800 text-indigo-600 focus:ring-0 focus:ring-offset-0"
                  />
                  <span>Enable Researcher grounding tools</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your objective (e.g., 'Build a high-performance Python TCP sockets server script...')"
                className="flex-1 bg-zinc-900 border border-zinc-850 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2 shadow-md disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Running Swarm
                  </>
                ) : (
                  "Dispatch Swarm"
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 border-t border-zinc-850 pt-3">
              <span className="font-semibold uppercase tracking-wider text-zinc-400">Speed race vs GPU (optional):</span>
              <select
                value={baselineProvider}
                onChange={(e) => setBaselineProvider(e.target.value)}
                disabled={loading}
                className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-300 focus:outline-none focus:border-indigo-500"
              >
                <option>OpenAI</option>
                <option>Groq</option>
                <option>Gemini</option>
                <option>Anthropic</option>
              </select>
              <input
                type="password"
                value={baselineKey}
                onChange={(e) => setBaselineKey(e.target.value)}
                disabled={loading}
                placeholder="Baseline key — measured live; leave blank to skip the race"
                className="flex-1 min-w-[240px] bg-zinc-900 border border-zinc-800 rounded px-3 py-1 text-zinc-300 focus:outline-none focus:border-indigo-500"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>
        </form>

        {/* Dynamic Swarm and Code Visualizer Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <SwarmVisualizer state={swarmState} />
          <Console
            generatedHtml={generatedHtml}
            generatedPython={generatedPython}
            onRunPython={handleRunPythonProxy}
          />
        </div>

        {/* Plain response markdown (if any text output is generated outside tabs) */}
        {responseText && (
          <div className="glass p-5 rounded-xl">
            <h3 className="font-bold text-white mb-2 border-b border-zinc-800 pb-2">Synthesizer Final Output Details</h3>
            <div className="prose prose-invert max-w-none text-sm text-zinc-300 leading-relaxed font-mono whitespace-pre-wrap max-h-80 overflow-y-auto bg-black/25 p-4 rounded-lg border border-zinc-900">
              {responseText}
            </div>
            <ArtifactExporter 
              content={responseText} 
              files={Object.fromEntries(
                Object.entries({
                  "generated.html": generatedHtml,
                  "generated.py": generatedPython
                }).filter(([_, v]) => v != null)
              ) as Record<string, string>} 
            />
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-zinc-600">
          <p>© 2026 ORCMEGA-AI & Nagabhushana Raju S. Developed for the Cerebras x Gemma 4 Hackathon.</p>
        </div>
      </footer>
    </div>
  );
}
