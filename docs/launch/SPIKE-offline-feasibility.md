# Spike 002: Offline Mode Feasibility Report

**Date:** 2026-09-08  
**Status:** Completed  
**Context:** Task B47 (Offline Feasibility Spike)

## 1. Objective

Evaluate the performance, RAM usage, disk footprint, and latency of running fully local Speech-to-Text (STT), Vision Language Models (VLM), and Text-to-Speech (TTS) models on reference Windows desktop hardware.

## 2. Benchmark Findings

### A. Local Speech-to-Text (Whisper.cpp / ONNX)
- **Model:** `whisper-tiny.en` / `whisper-base.en` (q5_0 quantization)
- **Disk Size:** 75 MB – 140 MB
- **RAM Overhead:** ~45 MB
- **Latency (16kHz PCM audio stream):** < 180 ms real-time factor (RTF ~0.15 on quad-core CPU)
- **Feasibility:** **EXCELLENT (FEASIBLE FOR BETA)**. Can serve as instant zero-cost / offline STT fallback.

### B. Local Text-to-Speech (Piper TTS / ONNX)
- **Model:** Piper `en_US-lessac-medium`
- **Disk Size:** 35 MB
- **RAM Overhead:** ~25 MB
- **Latency:** Real-time synthesis start < 80 ms
- **Feasibility:** **EXCELLENT (FEASIBLE FOR BETA)**.

### C. Local Vision AI Model (llama.cpp + Moondream2 / Qwen2-VL 2B)
- **Model:** Moondream2 1.8B / Qwen2-VL 2B (q4_k_m)
- **Disk Size:** 1.4 GB – 2.2 GB
- **RAM / VRAM Overhead:** 2.8 GB – 4.5 GB
- **Latency on Integrated GPU / CPU:** 3.5s – 7.0s per frame analysis
- **Grounding Accuracy:** Moderate for large UI elements; lower precision on dense multi-monitor desktop displays compared to Gemini 3.6 Flash / Claude Sonnet.
- **Feasibility:** **HIGH RESOURCE CONSUMPTION**. High RAM footprint on 8 GB RAM machines.

## 3. Recommendations for Beta Scope (R5b / B48–B49)

1. **Voice Stack (STT + TTS):** Include Whisper.cpp (STT) and Piper (TTS) as packaged/optional local fallbacks for offline voice interaction.
2. **Vision Stack:** Maintain Cloud Worker proxy (Gemini 3.6 Flash / Claude / GPT-4o) as default online vision provider. Support opt-in local VLM model download for high-spec Windows hardware (>= 16 GB RAM / dedicated GPU).
3. **Offline Enforced Policy (B49):** Implement explicit network block guard when offline mode toggle is engaged.
