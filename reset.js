module.exports = {
  run: [
    {
      method: "shell.run",
      params: {
        message: "git checkout ."
      }
    },
    {
      method: "notify",
      params: {
        html: "✅ Reset complete. The app has been reverted to its original state."
      }
    }
  ]
}
