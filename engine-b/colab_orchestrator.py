import os
import sys
import json
import time
import asyncio
import subprocess
import re
import tempfile
import logging

# ===========================================================================
#  OMNI SUPREME ORCHESTRATOR  v3  (Google Colab edition)
# ---------------------------------------------------------------------------
#  A unified, provider-agnostic multi-agent engine that fuses three designs:
#    • Multi-provider Gradio swarm        (Gemini / OpenAI / Anthropic / Groq)
#    • Live Web Preview + Colab-VM Python console
#    • Tool-augmented Researcher + specialized agents + resilient retries
#
#  Pipeline:  Plan ──► [Research (tools)] ──► Parallel Swarm ──► Synthesize
#                                               │
#                                               ▼
#                                       Critic ⇄ Refiner loop ──► VM extract
#
#  Upgrades over the originals:
#    - Dynamic worker count (planner decides 2–5 nodes, not a fixed 3)
#    - Role-specialized swarm nodes (analyst / risk / strategist / builder)
#    - Real web-search tool (DuckDuckGo, no API key) the Researcher can call
#    - Provider-agnostic resilience: exponential backoff on 429/5xx/overload
#    - Per-node error isolation (one failed node never kills the run)
#    - UI controls: enable tools, worker count, refinement depth
#    - Structured telemetry / logging
# ===========================================================================


def install_dependencies():
    """Installs required packages dynamically in Google Colab."""
    print("[+] Initializing Supreme Environment...")
    packages = [
        "gradio",
        "nest_asyncio",
        "httpx",
        "google-genai",
        "openai",
        "anthropic",
        "groq",
        "duckduckgo-search",   # free, no-API-key web search for the Researcher
    ]
    for pkg in packages:
        print(f"    -> Installing {pkg}...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", pkg])
    print("[+] Environment Ready.\n")


# Run installation before importing external libraries
install_dependencies()

import httpx
import nest_asyncio
import gradio as gr
from typing import List, Dict, Any, Callable

# Apply nest_asyncio to allow async/await inside Colab's existing event loop
nest_asyncio.apply()

# Structured telemetry (Phase 13: Observability, adapted from the ADK design)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] (Orchestrator) %(message)s",
)
log = logging.getLogger("omni")


# ===========================================================================
#  TOOLBOX  — real, provider-agnostic tools the agents can invoke
# ===========================================================================
class ToolBox:
    """A registry of callable tools. Tools are plain Python and return text,
    so they work identically regardless of which LLM provider is selected."""

    @staticmethod
    def web_search(query: str, max_results: int = 5) -> str:
        """Live web search via DuckDuckGo (no API key required)."""
        try:
            try:
                from duckduckgo_search import DDGS          # classic package name
            except ImportError:
                from ddgs import DDGS                         # newer renamed package
            results = []
            with DDGS() as ddgs:
                for r in ddgs.text(query, max_results=max_results):
                    results.append(f"- {r.get('title','')}: {r.get('body','')} ({r.get('href','')})")
            return "\n".join(results) if results else "No web results found."
        except Exception as e:
            return f"[web_search error: {e}]"

    @staticmethod
    def system_diagnostic(target_system: str, metric_type: str = "status") -> str:
        """Simulated real-time systems diagnostic (enterprise demo tool from the
        ADK design). Replace the body with a real API call in production."""
        log.info(f"Tool: system_diagnostic({target_system}, {metric_type})")
        return json.dumps({
            "system": target_system,
            "metric": metric_type,
            "status": "Operational",
            "current_load": "42%",
            "uptime": "99.999%",
        })

    @staticmethod
    def run_python(code: str) -> str:
        """Execute Python in the Colab VM sandbox and capture output."""
        return execute_vm_code(code)

    # registry: name -> (callable, human description for the ReAct prompt)
    @classmethod
    def registry(cls) -> Dict[str, Dict[str, Any]]:
        return {
            "web_search": {
                "fn": cls.web_search,
                "desc": "Search the live web. args: {\"query\": \"...\"}",
            },
            "system_diagnostic": {
                "fn": cls.system_diagnostic,
                "desc": "Query a system metric. args: {\"target_system\": \"...\", \"metric_type\": \"...\"}",
            },
            "run_python": {
                "fn": cls.run_python,
                "desc": "Run Python code and get stdout/stderr. args: {\"code\": \"...\"}",
            },
        }

    @classmethod
    def call(cls, name: str, args: Dict[str, Any]) -> str:
        spec = cls.registry().get(name)
        if not spec:
            return f"[unknown tool: {name}]"
        try:
            return str(spec["fn"](**args))
        except Exception as e:
            return f"[tool {name} failed: {e}]"

    @classmethod
    def manifest(cls) -> str:
        return "\n".join(f"  • {n}: {s['desc']}" for n, s in cls.registry().items())


# ===========================================================================
#  MODEL FETCHER  — dynamic model discovery per provider
# ===========================================================================
class ModelFetcher:
    """Dynamically fetches available models from the selected provider's API."""

    @staticmethod
    async def fetch_models(provider: str, api_key: str) -> List[str]:
        if not api_key:
            return ["Error: API Key required"]
        try:
            if provider == "Google Gemini":
                from google import genai
                client = genai.Client(api_key=api_key)
                models = client.models.list()
                return [m.name for m in models if "generateContent" in getattr(m, "supported_actions", [])]

            elif provider == "OpenAI":
                from openai import AsyncOpenAI
                client = AsyncOpenAI(api_key=api_key)
                models = await client.models.list()
                return sorted([m.id for m in models.data if any(k in m.id for k in ("gpt", "o1", "o3", "o4"))])

            elif provider == "Anthropic":
                async with httpx.AsyncClient(timeout=30) as client:
                    response = await client.get(
                        "https://api.anthropic.com/v1/models",
                        headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"},
                    )
                    response.raise_for_status()
                    data = response.json()
                    return [m["id"] for m in data.get("data", []) if "claude" in m["id"]]

            elif provider == "Groq":
                from groq import AsyncGroq
                client = AsyncGroq(api_key=api_key)
                models = await client.models.list()
                return sorted([m.id for m in models.data])

            else:
                return ["Error: Unknown Provider"]

        except Exception as e:
            return [f"Error fetching models: {str(e)}"]


# ===========================================================================
#  UNIVERSAL LLM  — one interface to every provider, with resilient retries
# ===========================================================================
class UniversalLLM:
    """A unified interface to execute prompts across any selected provider.
    Every call is wrapped with exponential backoff on transient failures
    (rate limits, overloads, 5xx, timeouts) — adapted from the ADK design."""

    RETRYABLE = ("429", "529", "rate", "overload", "resource_exhausted",
                 "timeout", "timed out", "503", "502", "500", "unavailable")

    def __init__(self, provider: str, model: str, api_key: str, max_retries: int = 4):
        self.provider = provider
        self.model = model
        self.api_key = api_key
        self.max_retries = max_retries

    def _is_retryable(self, msg: str) -> bool:
        m = msg.lower()
        return any(tok in m for tok in self.RETRYABLE)

    async def _call_once(self, system_prompt: str, user_prompt: str, temperature: float) -> str:
        if self.provider == "Google Gemini":
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=self.api_key)
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: client.models.generate_content(
                    model=self.model,
                    contents=user_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        temperature=temperature,
                    ),
                ),
            )
            return response.text

        elif self.provider == "OpenAI":
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=self.api_key)
            response = await client.chat.completions.create(
                model=self.model,
                messages=[{"role": "system", "content": system_prompt},
                          {"role": "user", "content": user_prompt}],
                temperature=temperature,
            )
            return response.choices[0].message.content

        elif self.provider == "Anthropic":
            from anthropic import AsyncAnthropic
            client = AsyncAnthropic(api_key=self.api_key)
            response = await client.messages.create(
                model=self.model,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
                temperature=temperature,
                max_tokens=4096,
            )
            return response.content[0].text

        elif self.provider == "Groq":
            from groq import AsyncGroq
            client = AsyncGroq(api_key=self.api_key)
            response = await client.chat.completions.create(
                model=self.model,
                messages=[{"role": "system", "content": system_prompt},
                          {"role": "user", "content": user_prompt}],
                temperature=temperature,
            )
            return response.choices[0].message.content

        raise ValueError(f"Unknown provider: {self.provider}")

    async def generate(self, system_prompt: str, user_prompt: str, temperature: float = 0.2) -> str:
        base_delay = 2
        last_err = ""
        for attempt in range(self.max_retries):
            try:
                return await self._call_once(system_prompt, user_prompt, temperature)
            except Exception as e:
                last_err = str(e)
                if self._is_retryable(last_err) and attempt < self.max_retries - 1:
                    delay = base_delay * (2 ** attempt)
                    log.warning(f"[{self.provider}] transient error; backing off {delay}s "
                                f"(attempt {attempt + 1}/{self.max_retries}): {last_err[:120]}")
                    await asyncio.sleep(delay)
                    continue
                break
        return f"[API ERROR - {self.provider}]: {last_err}"


# ===========================================================================
#  ORCHESTRATOR  — plan → research(tools) → swarm → synthesize → critic loop
# ===========================================================================
class SupremeOrchestrator:
    # Role library for specialized swarm nodes (cycled to match worker count)
    ROLES = [
        ("Lead Analyst", "Analyze the core requirements and logical structure with rigor."),
        ("Risk Auditor", "Hunt for edge cases, failure modes, security holes, and counter-arguments."),
        ("Strategist", "Provide the high-level strategy, trade-offs, and a clean execution plan."),
        ("Builder", "Produce concrete artifacts — code, schemas, or step-by-step procedures."),
        ("Domain Expert", "Add deep domain-specific knowledge and best practices."),
    ]

    def __init__(self, provider, model, api_key, use_tools=True, num_workers=3, max_refinements=2):
        self.llm = UniversalLLM(provider, model, api_key)
        self.use_tools = use_tools
        self.num_workers = max(1, min(5, int(num_workers)))
        self.max_refinements = max(0, min(4, int(max_refinements)))

    # ---- helpers ----------------------------------------------------------
    @staticmethod
    def _extract_json_array(text: str):
        """Robustly pull the first JSON array out of an LLM response."""
        cleaned = text.replace("```json", "").replace("```", "").strip()
        try:
            return json.loads(cleaned)
        except Exception:
            m = re.search(r"\[.*\]", cleaned, re.DOTALL)
            if m:
                try:
                    return json.loads(m.group(0))
                except Exception:
                    return None
        return None

    async def _research(self, prompt: str, log_cb: Callable[[str], None]) -> str:
        """Tool-augmented research loop (mini-ReAct). Bounded to a few steps."""
        if not self.use_tools:
            return ""
        sys_prompt = (
            "You are a Research Agent with access to real tools. To call a tool, reply with "
            "ONLY a JSON object: {\"tool\": \"<name>\", \"args\": {...}}. "
            "When you have gathered enough facts, reply with {\"done\": true, \"facts\": \"<concise findings>\"}.\n\n"
            f"AVAILABLE TOOLS:\n{ToolBox.manifest()}"
        )
        transcript = f"RESEARCH GOAL: {prompt}\n"
        gathered = []
        for step in range(3):
            decision = await self.llm.generate(sys_prompt, transcript, temperature=0.1)
            obj = None
            m = re.search(r"\{.*\}", decision, re.DOTALL)
            if m:
                try:
                    obj = json.loads(m.group(0))
                except Exception:
                    obj = None
            if not obj:
                break
            if obj.get("done"):
                gathered.append(obj.get("facts", ""))
                break
            tool, args = obj.get("tool"), obj.get("args", {})
            if not tool:
                break
            log_cb(f"   [TOOL] {tool}({json.dumps(args)[:60]})\n")
            result = ToolBox.call(tool, args)
            gathered.append(f"{tool} -> {result[:600]}")
            transcript += f"\nTOOL {tool} RESULT:\n{result[:1200]}\n"
        return "\n".join(g for g in gathered if g)

    async def _parallel_worker(self, worker_id: int, role: str, role_brief: str,
                               task_description: str, context: str, facts: str) -> str:
        sys_prompt = (
            f"You are Node {worker_id} — the {role}. {role_brief} "
            "Output raw, dense, non-redundant insights only."
        )
        prompt = f"TASK: {task_description}\n\nORIGINAL REQUEST: {context}"
        if facts:
            prompt += f"\n\nVERIFIED RESEARCH:\n{facts}"
        return await self.llm.generate(sys_prompt, prompt, temperature=0.4)

    # ---- main pipeline ----------------------------------------------------
    async def execute_workflow(self, prompt: str, history: list):
        empty_html = "<div style='padding:20px;color:gray;'>Waiting for Web App generation...</div>"
        empty_code = "# Waiting for Python code generation..."

        if not self.llm.api_key or not self.llm.model or "Awaiting" in str(self.llm.model):
            yield history + [[prompt, "ERROR: Missing API Key or Model selection."]], "Initialization Error.", empty_html, empty_code
            return

        logs = f"[SYSTEM] Engine online — {self.llm.provider} ({self.llm.model}) | "
        logs += f"workers={self.num_workers} tools={'on' if self.use_tools else 'off'} refine={self.max_refinements}\n"
        current_history = history + [[prompt, ""]]
        yield current_history, logs, empty_html, empty_code

        def emit(line):
            nonlocal logs
            logs += line

        try:
            # PHASE 1: PLANNER ---------------------------------------------------
            emit("[PLANNER] Deconstructing request into specialized sub-tasks...\n")
            yield current_history, logs, empty_html, empty_code

            plan_prompt = (
                f"Break the following request into exactly {self.num_workers} distinct, "
                "non-overlapping sub-tasks for parallel specialists. "
                "Output ONLY a JSON array of strings.\n\n"
                f"REQUEST: {prompt}"
            )
            plan_response = await self.llm.generate("You are a strict JSON planning system.", plan_prompt)
            sub_tasks = self._extract_json_array(plan_response)
            if not isinstance(sub_tasks, list) or not sub_tasks:
                emit("[PLANNER] Fallback triggered. Using default specialist paths...\n")
                sub_tasks = [
                    "Analyze the core technical requirements and logical structure.",
                    "Identify edge cases, risks, and counter-arguments.",
                    "Formulate the high-level strategy and formatting plan.",
                ][: self.num_workers]
            sub_tasks = [str(t) for t in sub_tasks][: self.num_workers]

            # PHASE 2: RESEARCH (tool-augmented) --------------------------------
            facts = ""
            if self.use_tools:
                emit("[RESEARCH] Tool-augmented fact gathering...\n")
                yield current_history, logs, empty_html, empty_code
                facts = await self._research(prompt, emit)
                if facts:
                    emit("[RESEARCH] Facts secured and injected into the swarm.\n")
                yield current_history, logs, empty_html, empty_code

            # PHASE 3: PARALLEL SWARM -------------------------------------------
            emit(f"[SWARM] Dispatching {len(sub_tasks)} specialized nodes...\n")
            for i, task in enumerate(sub_tasks):
                role = self.ROLES[i % len(self.ROLES)][0]
                emit(f"   -> Node {i+1} ({role}): {task[:48]}...\n")
            yield current_history, logs, empty_html, empty_code

            jobs = []
            for i, task in enumerate(sub_tasks):
                role, brief = self.ROLES[i % len(self.ROLES)]
                jobs.append(self._parallel_worker(i + 1, role, brief, task, prompt, facts))
            worker_outputs = await asyncio.gather(*jobs, return_exceptions=True)

            aggregated = ""
            for i, out in enumerate(worker_outputs):
                role = self.ROLES[i % len(self.ROLES)][0]
                if isinstance(out, Exception):
                    emit(f"   [WARN] Node {i+1} failed ({out}); continuing.\n")
                    continue
                aggregated += f"\n--- NODE {i+1} ({role}) ---\n{out}\n"
            if not aggregated.strip():
                aggregated = "(All nodes failed; synthesizing directly from the prompt.)"
            emit("[SWARM] Parallel execution complete. Insights aggregated.\n")
            yield current_history, logs, empty_html, empty_code

            # PHASE 4: SYNTHESIZER ----------------------------------------------
            emit("[SYNTHESIZER] Merging insights into Master Draft V1...\n")
            yield current_history, logs, empty_html, empty_code
            synth_sys = (
                "You are the Lead Synthesizer. Merge the multi-node insights into a single, "
                "cohesive, perfectly formatted response that directly fulfils the user's prompt. "
                "If code or a web app is appropriate, include it in fenced ```python or ```html blocks."
            )
            synth_prompt = f"USER PROMPT: {prompt}\n"
            if facts:
                synth_prompt += f"\nVERIFIED RESEARCH:\n{facts}\n"
            synth_prompt += f"\nPARALLEL NODE DATA:\n{aggregated}"
            current_draft = await self.llm.generate(synth_sys, synth_prompt, temperature=0.3)

            # PHASE 5: CRITIC-REFINER LOOP --------------------------------------
            for attempt in range(1, self.max_refinements + 1):
                emit(f"[CRITIC] Evaluating draft (iteration {attempt}/{self.max_refinements})...\n")
                yield current_history, logs, empty_html, empty_code
                critic_sys = (
                    "You are the Ultimate QA Evaluator. Check the draft against the original prompt. "
                    "If perfect and production-ready, reply EXACTLY 'STATUS: APPROVED'. "
                    "If flawed or shallow, reply 'STATUS: REJECTED' followed by a numbered list of exact fixes."
                )
                critic_prompt = f"ORIGINAL PROMPT: {prompt}\n\nCURRENT DRAFT:\n{current_draft}"
                critic_feedback = await self.llm.generate(critic_sys, critic_prompt, temperature=0.0)
                if "STATUS: APPROVED" in critic_feedback.upper():
                    emit("[CRITIC] APPROVED. Integrity confirmed.\n")
                    break
                emit("[CRITIC] REJECTED. Initiating targeted rewrite...\n")
                rewrite_sys = "You are the Refiner. Fix the draft strictly per the Critic's feedback. Keep what works."
                rewrite_prompt = f"DRAFT:\n{current_draft}\n\nFEEDBACK:\n{critic_feedback}"
                current_draft = await self.llm.generate(rewrite_sys, rewrite_prompt, temperature=0.2)

            # PHASE 6: VM EXTRACTION --------------------------------------------
            emit("[SYSTEM] Workflow complete. Extracting VM resources...\n")
            current_history[-1][1] = current_draft

            html_match = re.search(r"```html\n(.*?)```", current_draft, re.DOTALL)
            if html_match:
                raw_html = html_match.group(1).replace('"', '&quot;')
                preview_html = (
                    f'<iframe style="width:100%;height:600px;border:1px solid #3f3f46;'
                    f'border-radius:8px;background:white;" srcdoc="{raw_html}"></iframe>'
                )
                emit("[VM] Web app extracted and mounted to Live Preview.\n")
            else:
                preview_html = empty_html

            py_match = re.search(r"```python\n(.*?)```", current_draft, re.DOTALL)
            py_code = py_match.group(1) if py_match else empty_code
            if py_match:
                emit("[VM] Python executable extracted and mounted to the VM Console.\n")

            yield current_history, logs, preview_html, py_code

        except Exception as e:
            emit(f"\nCRITICAL PIPELINE FAILURE: {str(e)}")
            current_history[-1][1] = "An orchestration error occurred. Please check the telemetry log."
            yield current_history, logs, empty_html, empty_code


# ===========================================================================
#  COLAB VM CODE EXECUTION
# ===========================================================================
def execute_vm_code(code: str) -> str:
    """Executes Python code directly in the Colab VM environment."""
    if not code or "Waiting for Python" in code or code.startswith("# No executable"):
        return "No code to execute. Please generate Python code first."
    try:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(code)
            temp_path = f.name
        result = subprocess.run([sys.executable, temp_path], capture_output=True, text=True, timeout=60)
        output = f"--- EXECUTION COMPLETE (Code: {result.returncode}) ---\n\n"
        if result.stdout:
            output += f"--- STDOUT ---\n{result.stdout}\n"
        if result.stderr:
            output += f"--- STDERR ---\n{result.stderr}\n"
        return output
    except subprocess.TimeoutExpired:
        return "Error: Execution timed out after 60 seconds."
    except Exception as e:
        return f"VM Execution Failed: {str(e)}"


# ===========================================================================
#  GRADIO UI
# ===========================================================================
def create_ui():
    custom_theme = gr.themes.Default(
        primary_hue="blue", secondary_hue="slate", neutral_hue="zinc",
        font=[gr.themes.GoogleFont("Inter"), "ui-sans-serif", "system-ui", "sans-serif"],
    ).set(
        body_background_fill="*neutral_950",
        block_background_fill="*neutral_900",
        block_border_width="1px",
        block_border_color="*neutral_800",
        button_primary_background_fill="*primary_600",
        button_primary_background_fill_hover="*primary_500",
        text_color="*neutral_100",
    )

    with gr.Blocks(theme=custom_theme, title="Omni Supreme Orchestrator") as app:
        gr.Markdown(
            """
            # 🌐 Omni Supreme Orchestrator  ·  v3
            **Status:** `ONLINE` | **Architecture:** `Tool-Augmented Parallel Swarm` | **Mode:** `Agnostic Provider`
            """
        )

        with gr.Row():
            with gr.Column(scale=2):
                provider_dropdown = gr.Dropdown(
                    choices=["Google Gemini", "OpenAI", "Anthropic", "Groq"],
                    label="Intelligence Provider", value="Google Gemini",
                )
            with gr.Column(scale=4):
                api_key_input = gr.Textbox(
                    label="Provider API Key",
                    placeholder="Enter API Key to unlock model fetching...", type="password",
                )
            with gr.Column(scale=1):
                fetch_btn = gr.Button("🔄 Fetch Models", variant="secondary")
            with gr.Column(scale=3):
                model_dropdown = gr.Dropdown(
                    choices=["Awaiting API Key..."], label="Target Model",
                    value="Awaiting API Key...", interactive=True,
                )

        with gr.Row():
            use_tools_chk = gr.Checkbox(value=True, label="🛠️ Enable Tools (web search + research)")
            workers_slider = gr.Slider(1, 5, value=3, step=1, label="⚡ Parallel Worker Nodes")
            refine_slider = gr.Slider(0, 4, value=2, step=1, label="🔁 Critic Refinement Rounds")

        with gr.Row():
            with gr.Column(scale=3):
                with gr.Tabs():
                    with gr.Tab("💬 Orchestrator Chat"):
                        chatbot = gr.Chatbot(label="Output", height=550, show_copy_button=True, type="tuples")
                    with gr.Tab("🌐 Live Web Preview"):
                        web_preview = gr.HTML("<div style='padding:20px;color:gray;'>Web apps generated by the swarm render here.</div>")
                    with gr.Tab("💻 Colab VM Console"):
                        vm_code = gr.Code(label="Extracted Source Code", language="python", interactive=True)
                        run_btn = gr.Button("▶️ Execute Code on Colab VM", variant="primary")
                        vm_output = gr.Textbox(label="VM Terminal Output", lines=15, interactive=False)

                with gr.Row():
                    user_input = gr.Textbox(
                        show_label=False, placeholder="Enter complex task for parallel execution...",
                        scale=8, container=False,
                    )
                    submit_btn = gr.Button("Initialize Run", variant="primary", scale=1)

            with gr.Column(scale=1):
                agent_logs = gr.Textbox(label="Swarm Telemetry & Trace", lines=30, interactive=False, elem_id="log_console")

        async def update_models(provider, api_key):
            if not api_key:
                return gr.update(choices=["API Key Required"], value="API Key Required")
            models = await ModelFetcher.fetch_models(provider, api_key)
            if not models:
                return gr.update(choices=["No models found"], value="No models found")
            return gr.update(choices=models, value=models[0])

        fetch_btn.click(fn=update_models, inputs=[provider_dropdown, api_key_input], outputs=[model_dropdown])

        async def process_ui_action(prompt, history, provider, model, api_key, use_tools, workers, refine):
            if not prompt.strip():
                yield history, "Waiting for input...", gr.update(), gr.update()
                return
            orchestrator = SupremeOrchestrator(
                provider, model, api_key,
                use_tools=use_tools, num_workers=workers, max_refinements=refine,
            )
            async for updated_history, updated_logs, html, py_code in orchestrator.execute_workflow(prompt, history):
                yield updated_history, updated_logs, html, py_code

        run_inputs = [user_input, chatbot, provider_dropdown, model_dropdown, api_key_input,
                      use_tools_chk, workers_slider, refine_slider]
        run_outputs = [chatbot, agent_logs, web_preview, vm_code]

        submit_btn.click(fn=process_ui_action, inputs=run_inputs, outputs=run_outputs).then(
            fn=lambda: "", inputs=None, outputs=user_input)
        user_input.submit(fn=process_ui_action, inputs=run_inputs, outputs=run_outputs).then(
            fn=lambda: "", inputs=None, outputs=user_input)

        run_btn.click(fn=execute_vm_code, inputs=[vm_code], outputs=[vm_output])

    return app


if __name__ == "__main__":
    print("\n[+] Omni Supreme Orchestrator v3 Initialized.")
    print("[+] Tool-augmented parallel execution enabled. Multi-provider endpoints active.")
    app = create_ui()
    # Share=True generates a public gradio.live link automatically
    app.launch(inline=True, share=True, debug=True)
