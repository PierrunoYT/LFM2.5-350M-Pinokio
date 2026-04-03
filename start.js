module.exports = {
  daemon: true,
  run: [
    {
      method: "notify",
      params: {
        html: "Starting LFM2.5-350M Reader + Q&A server..."
      }
    },
    {
      method: "shell.run",
      params: {
        path: "app",
        message: "npx --yes serve . -l {{port}} -s",
        on: [{
          event: "/(http:\\/\\/[0-9.:]+)/",
          done: true
        }]
      }
    },
    {
      method: "local.set",
      params: {
        url: "{{input.event[1]}}"
      }
    },
    {
      method: "notify",
      params: {
        html: "LFM2.5-350M Reader + Q&A is running. Open the Web UI to convert text, summarize sections, and ask questions."
      }
    }
  ]
}
