import { pipeline, TextStreamer } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers";

let generator = null;

self.addEventListener("message", async (e) => {
  const { type } = e.data;

  if (type === "load") {
    try {
      generator = await pipeline("text-generation", "onnx-community/LFM2.5-350M-ONNX", {
        dtype: "q4",
        device: "webgpu",
        progress_callback: (progress) => {
          if (progress.status === "progress") {
            self.postMessage({ type: "progress", progress: progress.progress });
          }
        },
      });
      self.postMessage({ type: "ready" });
    } catch (err) {
      self.postMessage({ type: "error", message: err.message });
    }
  } else if (type === "generate") {
    if (!generator) {
      self.postMessage({ type: "error", message: "Model not loaded" });
      return;
    }

    const { generationId } = e.data;

    try {
      const streamer = new TextStreamer(generator.tokenizer, {
        skip_prompt: true,
        callback_function: (token) => {
          self.postMessage({ type: "token", token, generationId });
        },
      });

      const output = await generator(e.data.messages, {
        max_new_tokens: 512,
        do_sample: false,
        streamer,
      });

      const assistantMessage = output[0].generated_text.at(-1).content;
      self.postMessage({ type: "done", output: assistantMessage, generationId });
    } catch (err) {
      self.postMessage({ type: "error", message: err.message });
    }
  }
});
