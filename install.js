module.exports = {
  run: [
    {
      method: "notify",
      params: {
        html: "No local Python or GPU setup is required. The WebGPU app loads the ONNX model from Hugging Face when you open the Web UI. Click <strong>Start</strong> to serve the app."
      }
    }
  ]
}
