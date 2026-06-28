<div align="center">

# Ekathvam·OmniSwarm

### A dual “Twin-Engine” multi-agent orchestrator on Gemma 4 31B, powered by Cerebras

![Model: Gemma 4 31B](https://img.shields.io/badge/model-Gemma_4_31B-5b8cff)
![Inference: Cerebras](https://img.shields.io/badge/inference-Cerebras-36d399)
![Status](https://img.shields.io/badge/status-production_ready-success)
![Hackathon](https://img.shields.io/badge/Cerebras_%C3%97_Gemma_4-Hackathon-5b8cff)
![License](https://img.shields.io/badge/license-AGPLv3-red)

**The working prototype is complete and fully prepared for deployment.**

</div>

---

## 🏆 Built for the Cerebras × Google DeepMind Gemma 4 Hackathon

This project is built for the **Cerebras × Google DeepMind Gemma 4 Hackathon** — a 24-hour sprint to build agentic, multimodal applications at the speed of thought.

- **Cerebras Cloud WSE-3** powers inference at hundreds of tokens per second with ultra-low latency, making interactive multi-agent workflows feasible for production.
- **Gemma 4 31B** is Google DeepMind's flagship open model optimized for tool use, coding tasks, and multi-agent coordination.

OmniSwarm satisfies the rubrics for all three tracks: **Multiverse Agents** (multi-agent coordination + tools), **Enterprise Impact** (DPDP privacy + production readiness), and **People's Choice** (real-time telemetry).

---

## ⚙️ The Twin-Engine Architecture

OmniSwarm deploys its shared orchestration pipeline across two parallel execution vectors:

### 1. Engine A: Vercel Edge Web Application (Next.js)
A production-ready React 19 app compiled for Vercel Edge Serverless functions. It streams live node-by-node pipeline telemetry directly to the browser via SSE:
- **Cerebras Speed HUD:** Side-by-side live comparison tracking Time to First Token (TTFT), tokens per second (TPS), and total token counts against standard GPU baseline nodes.
- **Swarm Visualizer:** Renders the Planner (subtask decomposition), Grounding Researcher (DuckDuckGo web search), parallel specialist nodes (Lead Analyst, Risk Auditor, Strategist), and the Critic-Refiner quality assurance loop.
- **Workspace Console:** Extracted HTML blocks render in a secure Live Web Preview iframe, and generated Python blocks can be edited and executed inside a sandboxed VM simulator.

### 2. Engine B: Google Colab PoC (Python)
Located in `engine-b/colab_orchestrator.py`, this is a standalone Python CLI and Gradio UI designed for immediate verification. Technical judges can run the entire agent swarm, DuckDuckGo tools, and Python interpreter inside their own isolated notebook environments.

---

## 🛡️ Privacy & Compliance (India DPDP Act 2023 Alignment)

OmniSwarm implements a strict **BYO-key model** to ensure data security:
- **Zero Server-side Storage:** Ephemeral keys and prompts are held in memory only for the request lifetime and are scrubbed post-response. No databases or file logs are maintained.
- **WebCrypto Envelope:** The client-side toggle enables AES-GCM envelope encryption before TLS transport.
- **Right to Erasure:** Clicking **Delete My Data** erases all local session keys and prompts, triggers a backend scrub, and produces a cryptographically signed "Deletion Tombstone" receipt verifying erasure.
- **DPDP Role Mapping:** The UI documents roles honestly, setting the User as the *Data Fiduciary* and OmniSwarm as the *Data Processor*.

---

## 🚀 Getting Started

### Local Development (Engine A)

1. Clone the repository and install npm packages:
   ```bash
   cd Ekathvam-OmniSwarm
   npm install
   ```
2. Start the local Next.js server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your browser. Enter your Cerebras Cloud key to begin.

### Colab Execution (Engine B)

1. Run the Python Gradio script locally or in a Colab cell:
   ```bash
   python engine-b/colab_orchestrator.py
   ```
2. Gradio will automatically initialize a public tunnel link `gradio.live` for remote verification.

---

## 👤 Credits & Contributors

- **Nagabhushana Raju S** — Creator & Lead Developer (Ekathvam Founder)
- **ORCMEGA-AI** — Architectural Planning & Swarm Orchestrator System (https://github.com/ORCMEGA-AI)

## 📜 License

This project is licensed under the **GNU Affero General Public License v3 (AGPLv3)**. See [LICENSE](LICENSE) for full details. Modified network deployments must remain open-source.
