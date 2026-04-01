# LFM2.5-350M — WebGPU Chat + Summarize (Pinokio)

In-browser text generation powered by [LiquidAI/LFM2.5-350M](https://huggingface.co/LiquidAI/LFM2.5-350M) via [transformers.js](https://huggingface.co/docs/transformers.js) and WebGPU. No GPU server required; the model runs entirely in your browser for both chat and text summarization.

## Model

- **Base model**: [LiquidAI/LFM2.5-350M](https://huggingface.co/LiquidAI/LFM2.5-350M)
- **Browser ONNX model**: [onnx-community/LFM2.5-350M-ONNX](https://huggingface.co/onnx-community/LFM2.5-350M-ONNX) (q4 quantized)

## Requirements

- A modern browser with **WebGPU** support (Chrome 113+, Edge 113+)
- No Python, no GPU server, no CUDA needed

## How It Works

1. The app is served as a static HTML/JS page via a local HTTP server
2. A Web Worker loads the q4-quantized ONNX model from HuggingFace CDN using `transformers.js`
3. Inference runs directly in the browser via WebGPU
4. Tokens are streamed back to the UI in real time
5. The model is cached in the browser after the first download

## Getting Started (Pinokio)

1. **Install** — Click the Install button (no dependencies to download)
2. **Start** — Click Start to launch the local HTTP server
3. **Open Web UI** — Click "Open Web UI" to open the chat and summarization interface
4. The model will download automatically on first use (~200MB)

## Features

- **Chat tab** for normal conversation with the model
- **Summarize tab** for pasting your own text and generating a concise summary
- Streaming token output powered by the same browser-side WebGPU model

## Architecture

```
Browser (index.html)
  └─ Web Worker (worker.js)
       └─ transformers.js pipeline
            └─ WebGPU inference (onnx-community/LFM2.5-350M-ONNX)
```
