<div align="center">

# Ekathvam·OmniSwarm

### A dual “Twin-Engine” multi-agent orchestrator on Gemma 4 31B, served by Cerebras

![Model: Gemma 4 31B](https://img.shields.io/badge/model-Gemma_4_31B-5b8cff)
![Inference: Cerebras](https://img.shields.io/badge/inference-Cerebras-36d399)
![Status](https://img.shields.io/badge/status-in_active_development-fbbd23)
![Hackathon](https://img.shields.io/badge/Cerebras_%C3%97_Gemma_4-Hackathon-5b8cff)

*Project kickoff — this README captures the initial vision and assumptions. The build follows.*

</div>

---

## 🏆 Built for the Cerebras × Google DeepMind Gemma 4 Hackathon

This project is being built for the **[Cerebras](https://www.cerebras.ai) × Google DeepMind Gemma 4 Hackathon** — a 24-hour sprint to build agentic, multimodal applications on the latest open models at the speed of thought.

**Why this pairing is special:**
- **Cerebras** builds the **Wafer-Scale Engine (WSE-3)** — the largest AI chip ever made (4 trillion transistors, 900,000 cores) — powering the fastest inference cloud on the planet. It runs **Gemma 4 31B at >1,500 tokens/sec**, making interactive multi-agent UX actually feasible.
- **Gemma 4** is Google DeepMind’s open-weight model family. **Gemma 4 31B** is its first multimodal, first-DeepMind model on Cerebras — 30.7B params, **256K context**, text + image, Apache-2.0.

We target **all three tracks**: Multiverse Agents · Enterprise Impact · People’s Choice.

## 🎯 The vision

Agentic AI forces three bad trade-offs — **latency** (chained agents are unusably slow on GPUs), **trust** (keys pasted into backends that log/train on your data), and **reproducibility** (black-box demos judges can’t run). Ekathvam-OmniSwarm is being built to solve all three at once.

**Initial assumptions / design intent:**
- **One shared orchestration pipeline** — *Plan → Research → Parallel role swarm → Synthesize → Critic ⇄ Refiner → Extract* — running identically across **two engines**:
  - **Engine A** — a production Next.js / Vercel Edge web app, with a live self-assembling swarm graph, a Cerebras Speed HUD, and a Cerebras-vs-GPU race.
  - **Engine B** — a one-cell Google Colab notebook any judge can run by pasting their own key.
- A **Skill-Agents-Mapped Worker built 100% from scratch** (typed registry, role→skill authorization, deterministic dispatch).
- **Multimodal** on Gemma 4 31B (text + image).
- **Zero-retention, bring-your-own-key privacy**: client-side encryption, no server storage, one-click “Delete My Data”, aligned with India’s DPDP (no-store · no-sell · no-train).

## 🗺️ Roadmap

- **M0** — Twin-Engine scaffolding + UniversalLLM + Cerebras adapter
- **M1** — Orchestration core (the shared pipeline) in both engines
- **M2** — From-scratch Skill-Agents-Mapped Worker + tests
- **M3** — Tools + multimodal (web search, Gemma 4 image input)
- **M4** — Speed HUD + Cerebras-vs-GPU benchmark
- **M5** — Privacy layer (BYO-key, encryption, Delete My Data)
- **M6** — Polish + reproducible Colab
- **M7** — 60s demo + launch

> Full engineering brief lives in [`docs/planning/`](docs/planning/) — project overview, PRD, architecture, build plan, task breakdown, design system and security model.

## 👤 Author

**Nagabhushana Raju S** — creator & architect.
Planned, built, and signed under **ORCMEGA — by Nagabhushana**.

## 📜 License

Will be released under **AGPL-3.0-or-later**.

---

<div align="center"><sub>Ekathvam·OmniSwarm · Gemma 4 31B on Cerebras · by Nagabhushana Raju S</sub></div>
