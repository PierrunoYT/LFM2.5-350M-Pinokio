module.exports = {
  daemon: true,
  run: [
    {
      method: "notify",
      params: {
        html: "Starting LFM2.5-350M Chat + Summarize server…"
      }
    },
    {
      method: "shell.run",
      params: {
        path: ".",
        message: "npx --yes serve . -l {{port}} -s",
        on: [{
          event: "/(http:\\/\\/\\S+)/",
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
        html: "✅ LFM2.5-350M Chat + Summarize is running! Open the Web UI to chat or summarize your own text."
      }
    }
  ]
}
