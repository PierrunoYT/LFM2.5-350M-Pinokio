module.exports = {
  run: [{
    method: "shell.run",
    params: {
      path: ".",
      message: "git pull",
    }
  }, {
    method: "notify",
    params: {
      html: "Update complete."
    }
  }]
}
