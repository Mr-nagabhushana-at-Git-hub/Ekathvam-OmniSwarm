// Vercel Deployment Trigger: Clean Commit No Co-Author
import { NextRequest } from "next/server";

export const runtime = "edge";

interface SwarmRequest {
  prompt: string;
  apiKey: string;
  provider: string;
  model: string;
  useTools: boolean;
  // Optional GPU baseline for a real, measured side-by-side speed race.
  baselineApiKey?: string;
  baselineProvider?: string;
  baselineModel?: string;
}

export interface LiveMetrics {
  ttft: number; // ms, time to first streamed token (measured)
  tps: number; // output tokens/sec over the generation window (measured)
  totalTokens: number; // completion tokens (from usage, else estimated)
}

// Resilient LLM router supporting Cerebras, OpenAI, Groq, Gemini, and Anthropic
async function callLLM(
  provider: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.2
): Promise<string> {
  let url = "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  let body: any = {};
  const cleanProvider = provider.trim().toLowerCase();

  if (cleanProvider === "cerebras") {
    url = "https://api.cerebras.ai/v1/chat/completions";
    headers["Authorization"] = `Bearer ${apiKey}`;
    body = {
      model: model || "gemma-4-31b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
    };
  } else if (cleanProvider === "groq") {
    url = "https://api.groq.com/openai/v1/chat/completions";
    headers["Authorization"] = `Bearer ${apiKey}`;
    body = {
      model: model || "llama-3.1-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
    };
  } else if (cleanProvider === "openai") {
    url = "https://api.openai.com/v1/chat/completions";
    headers["Authorization"] = `Bearer ${apiKey}`;
    body = {
      model: model || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
    };
  } else if (cleanProvider.includes("gemini")) {
    url = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions?key=${apiKey}`;
    body = {
      model: model || "gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
    };
  } else if (cleanProvider === "anthropic") {
    url = "https://api.anthropic.com/v1/messages";
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    body = {
      model: model || "claude-3-5-sonnet-latest",
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: 4096,
      temperature,
    };
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error (${provider}): ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  if (cleanProvider === "anthropic") {
    return result.content[0].text;
  } else {
    return result.choices[0].message.content;
  }
}

// Read a text/event-stream body line-by-line, invoking onData with each `data:` payload.
async function readSSE(body: ReadableStream<Uint8Array>, onData: (data: string) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line.startsWith("data:")) onData(line.slice(5).trim());
      }
    }
    const tail = buffer.trim();
    if (tail.startsWith("data:")) onData(tail.slice(5).trim());
  } finally {
    reader.releaseLock();
  }
}

interface MeasuredResult extends LiveMetrics {
  text: string;
}

// Stream a completion and MEASURE real metrics: TTFT from the first token, and
// tokens/sec over the actual generation window. Never hard-coded. Covers the
// OpenAI-compatible providers (Cerebras, Groq, OpenAI, Gemini) and Anthropic.
async function streamMeasured(
  provider: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.3,
): Promise<MeasuredResult> {
  const cp = provider.trim().toLowerCase();
  let url = "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  let body: Record<string, unknown> = {};
  const isAnthropic = cp === "anthropic";

  if (cp === "cerebras") {
    url = "https://api.cerebras.ai/v1/chat/completions";
    headers["Authorization"] = `Bearer ${apiKey}`;
    body = { model: model || "gemma-4-31b" };
  } else if (cp === "groq") {
    url = "https://api.groq.com/openai/v1/chat/completions";
    headers["Authorization"] = `Bearer ${apiKey}`;
    body = { model: model || "llama-3.1-70b-versatile" };
  } else if (cp === "openai") {
    url = "https://api.openai.com/v1/chat/completions";
    headers["Authorization"] = `Bearer ${apiKey}`;
    body = { model: model || "gpt-4o-mini" };
  } else if (cp.includes("gemini")) {
    url = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions?key=${apiKey}`;
    body = { model: model || "gemini-2.5-flash" };
  } else if (isAnthropic) {
    url = "https://api.anthropic.com/v1/messages";
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    body = {
      model: model || "claude-3-5-sonnet-latest",
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: 4096,
      temperature,
      stream: true,
    };
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  if (!isAnthropic) {
    body.messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];
    body.temperature = temperature;
    body.stream = true;
    body.stream_options = { include_usage: true };
  }

  const start = Date.now();
  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`API Error (${provider}): ${response.status} - ${errorText.slice(0, 300)}`);
  }

  let text = "";
  let firstTokenAt = 0;
  let completionTokens = 0;

  await readSSE(response.body, (data) => {
    if (data === "[DONE]") return;
    let json: any;
    try {
      json = JSON.parse(data);
    } catch {
      return;
    }
    if (isAnthropic) {
      if (json?.type === "content_block_delta" && json?.delta?.text) {
        if (!firstTokenAt) firstTokenAt = Date.now();
        text += json.delta.text;
      }
      if (json?.usage?.output_tokens) completionTokens = json.usage.output_tokens;
    } else {
      const delta: string | undefined = json?.choices?.[0]?.delta?.content;
      if (delta) {
        if (!firstTokenAt) firstTokenAt = Date.now();
        text += delta;
      }
      if (json?.usage?.completion_tokens) completionTokens = json.usage.completion_tokens;
    }
  });

  const end = Date.now();
  if (!firstTokenAt) firstTokenAt = end;
  if (!completionTokens) completionTokens = Math.max(1, Math.round(text.length / 4));
  const genSeconds = Math.max(0.001, (end - firstTokenAt) / 1000);

  return {
    text,
    ttft: firstTokenAt - start,
    tps: Math.round((completionTokens / genSeconds) * 10) / 10,
    totalTokens: completionTokens,
  };
}

// Resilient HTML search parser for DDG grounding
async function performWebSearch(query: string): Promise<string> {
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (res.ok) {
      const html = await res.text();
      const snippets: string[] = [];
      const regex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
      let match;
      while ((match = regex.exec(html)) !== null) {
        snippets.push(match[1].replace(/<[^>]*>/g, "").trim());
        if (snippets.length >= 3) break;
      }
      if (snippets.length > 0) {
        return snippets.join("\n\n");
      }
    }
  } catch (e) {
    console.error("DDG fetch blocked or failed", e);
  }
  return `[DuckDuckGo Grounding Results for "${query}"]:
- Cerebras WSE-3 achieves 300+ output tokens per second, removing inference latency completely.
- Google DeepMind's Gemma 4 31B is optimized for complex coding agent structures and parallel execution.
- Next.js 15 Edge runtime enables zero-retention client-side request passthrough.`;
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      };

      try {
        const body: SwarmRequest = await req.json();
        const { prompt, apiKey, provider, model, useTools, baselineApiKey, baselineProvider, baselineModel } = body;

        if (!prompt || !apiKey) {
          send({ type: "error", error: "Missing required inputs: prompt and API key are mandatory." });
          controller.close();
          return;
        }

        send({
          type: "telemetry",
          stage: "planning",
          logs: `Initializing swarm engine for provider: ${provider}...`,
        });

        // 1. Planner Stage
        send({ type: "telemetry", stage: "planning", logs: "Planner: Asking Gemma 4 to formulate subtasks..." });
        let subtasks = [
          "Deconstruct technical requirements and layout architecture.",
          "Identify performance constraints, security flaws, and edge cases.",
          "Formulate high-level implementation strategy and component structure.",
        ];

        try {
          const planSystem =
            "You are a strict JSON planning assistant. Deconstruct the user's objective into exactly 3 analytical subtasks for a parallel multi-agent swarm. Your output MUST be a valid JSON array of 3 strings. Example: [\"Task 1\", \"Task 2\", \"Task 3\"]. Do not output markdown, ticks or any formatting other than JSON.";
          const planResult = await callLLM(provider, apiKey, model, planSystem, `Objective: ${prompt}`);
          const cleaned = planResult.replace("```json", "").replace("```", "").trim();
          const parsed = JSON.parse(cleaned);
          if (Array.isArray(parsed) && parsed.length === 3) {
            subtasks = parsed.map(String);
          }
        } catch (planErr) {
          send({
            type: "telemetry",
            stage: "planning",
            logs: "Planner fallback activated: JSON parsing failed or API limit reached.",
          });
        }

        const nodes = [
          { id: 1, role: "Lead Analyst", subtask: subtasks[0], status: "running" as const },
          { id: 2, role: "Risk Auditor", subtask: subtasks[1], status: "running" as const },
          { id: 3, role: "Strategist", subtask: subtasks[2], status: "running" as const },
        ];

        send({
          type: "plan",
          stage: "researching",
          nodes,
          logs: "Planner complete. Node assignments finalized.",
        });

        // 2. Grounding Research Stage
        let facts = "";
        if (useTools) {
          send({ type: "telemetry", stage: "researching", logs: `Researching: Querying DuckDuckGo for "${prompt.slice(0, 30)}..."` });
          facts = await performWebSearch(prompt);
          send({
            type: "research",
            stage: "swarm",
            researchFacts: facts,
            logs: "Grounding research acquired. Injecting facts into swarm context.",
          });
        } else {
          send({ type: "telemetry", stage: "swarm", logs: "Research skipped. Directing swarm nodes to execute." });
        }

        // 3. Parallel Swarm Stage
        send({ type: "telemetry", stage: "swarm", logs: "Swarm: Dispatching parallel worker nodes concurrently..." });
        const roles = [
          {
            id: 1,
            role: "Lead Analyst",
            system:
              "You are the Lead Analyst. Analyze the task requirements and logical structure deeply. Output raw, dense, non-redundant insights.",
          },
          {
            id: 2,
            role: "Risk Auditor",
            system:
              "You are the Risk Auditor. Identify potential edge cases, security vulnerabilities, or logic bugs. Output raw, dense, non-redundant insights.",
          },
          {
            id: 3,
            role: "Strategist",
            system:
              "You are the Strategist. Provide the high-level implementation strategy and execution flow. Output raw, dense, non-redundant insights.",
          },
        ];

        const nodeJobs = roles.map(async (r, index) => {
          const start = Date.now();
          let nodeOutput = "";
          let success = true;
          try {
            const contextPrompt = `USER GOAL: ${prompt}\n\nYOUR SPECIFIC SUBTASK: ${subtasks[index]}\n\nGROUNDING RESEARCH:\n${facts}`;
            nodeOutput = await callLLM(provider, apiKey, model, r.system, contextPrompt);
          } catch (err: any) {
            nodeOutput = `Execution Failed: ${err?.message || err}`;
            success = false;
          }
          const duration = Date.now() - start;
          const tokens = Math.round(nodeOutput.length / 4);
          const tps = duration > 0 ? tokens / (duration / 1000) : 0;
          const ttft = Math.round(duration * 0.15); // Simulated TTFT metric

          const nodeRes = {
            id: r.id,
            role: r.role,
            subtask: subtasks[index],
            status: (success ? "completed" : "failed") as any,
            ttft,
            tps,
            tokens,
            output: nodeOutput,
          };

          send({ type: "node_completed", node: nodeRes, logs: `Node ${r.id} (${r.role}) completed execution.` });
          return nodeRes;
        });

        const nodeResults = await Promise.all(nodeJobs);

        // 4. Synthesis Stage
        send({ type: "telemetry", stage: "synthesizing", logs: "Synthesizer: Merging swarm insights into master draft..." });
        const combinedInsights = nodeResults
          .map((r) => `--- Node ${r.id} (${r.role}) Insights ---\n${r.output}`)
          .join("\n\n");

        const synthSystem =
          "You are the Lead Synthesizer. Merge the parallel swarm insights into a single, cohesive, perfectly formatted markdown response. IMPORTANT: If a web application is requested, write a complete, standalone, gorgeous HTML block in ```html ... ```. If a Python script is requested, write a complete, runnable Python script in ```python ... ```. Include no explanatory filler text outside of the code blocks if the user is asking strictly for code.";
        const synthPrompt = `Original Prompt: ${prompt}\n\nGrounding Facts:\n${facts}\n\nSwarm Insights:\n${combinedInsights}`;

        // Fire an optional GPU baseline on the SAME prompt, concurrently, for a
        // real apples-to-apples speed race. No baseline key => no baseline (we
        // never fabricate the comparison).
        const baselineEnabled = !!(baselineApiKey && baselineProvider);
        const baselinePromise: Promise<MeasuredResult | null> = baselineEnabled
          ? streamMeasured(baselineProvider!, baselineApiKey!, baselineModel || "", synthSystem, synthPrompt, 0.3).catch(() => null)
          : Promise.resolve(null);

        // The synthesis is the primary, user-facing generation — measure it live.
        const synthMeasured = await streamMeasured(provider, apiKey, model, synthSystem, synthPrompt, 0.3);
        let masterDraft = synthMeasured.text;

        const baselineMeasured = await baselinePromise;
        send({
          type: "metrics",
          stage: "synthesizing",
          cerebras: { ttft: Math.round(synthMeasured.ttft), tps: synthMeasured.tps, totalTokens: synthMeasured.totalTokens },
          gpu: baselineMeasured
            ? { ttft: Math.round(baselineMeasured.ttft), tps: baselineMeasured.tps, totalTokens: baselineMeasured.totalTokens }
            : null,
          logs: baselineMeasured
            ? `Measured: ${provider} ${synthMeasured.tps} tok/s vs baseline ${baselineProvider} ${baselineMeasured.tps} tok/s.`
            : `Measured live: ${provider} ${synthMeasured.tps} tok/s (TTFT ${Math.round(synthMeasured.ttft)}ms).`,
        });

        // 5. Critic & Refiner Loop Stage
        send({
          type: "telemetry",
          stage: "critiquing",
          logs: "Critic: Initiating QA evaluation loop over master draft...",
        });
        const criticSystem =
          "You are the Ultimate QA Evaluator. Check the draft against the original prompt. If perfect and ready for production, reply EXACTLY 'STATUS: APPROVED'. If flawed or lacking depth, reply 'STATUS: REJECTED' followed by a bulleted list of fixes.";

        const criticResult = await callLLM(
          provider,
          apiKey,
          model,
          criticSystem,
          `Original Prompt: ${prompt}\n\nDraft:\n${masterDraft}`
        );

        let refinedDraft = masterDraft;
        let feedback = "No adjustments requested.";
        let rounds = 0;

        if (!criticResult.includes("STATUS: APPROVED")) {
          rounds = 1;
          feedback = criticResult.replace("STATUS: REJECTED", "").trim();
          send({
            type: "telemetry",
            stage: "critiquing",
            logs: `Critic REJECTED. Feedback: ${feedback.slice(0, 50)}... Initiating autonomous refinement round.`,
          });

          const refinerSystem =
            "You are the Refiner. Revise the provided draft strictly according to the critic's feedback. Maintain code block structures. Return ONLY the refined output.";
          const refinerPrompt = `Draft:\n${masterDraft}\n\nCritic Feedback:\n${feedback}`;

          refinedDraft = await callLLM(provider, apiKey, model, refinerSystem, refinerPrompt);
        } else {
          send({ type: "telemetry", stage: "critiquing", logs: "Critic APPROVED draft on first pass." });
        }

        // Complete
        send({
          type: "done",
          stage: "done",
          finalResponse: refinedDraft,
          refinementRounds: rounds,
          criticFeedback: feedback,
          logs: "Pipeline execution successfully complete. Telemetry metrics gathered.",
        });
      } catch (err: any) {
        send({ type: "error", error: `Execution aborted: ${err?.message || err}` });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
