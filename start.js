module.exports = {
  daemon: true,
  run: [
    {
      method: "notify",
      params: {
        html: "Starting LFM2.5-350M Chat server…"
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
        html: "✅ LFM2.5-350M Chat is running! Open the Web UI to start chatting."
      }
    }
  ]
}
