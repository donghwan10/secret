const childProcess = require("node:child_process");

const originalExec = childProcess.exec;

childProcess.exec = function patchedExec(command, ...args) {
  if (typeof command === "string" && command.trim().toLowerCase() === "net use") {
    const callback = args.find((value) => typeof value === "function");
    if (callback) {
      process.nextTick(() => {
        callback(new Error("Sandbox blocked net use"), "", "");
      });
    }

    return {
      kill() {},
      on() {
        return this;
      }
    };
  }

  return originalExec.call(this, command, ...args);
};
