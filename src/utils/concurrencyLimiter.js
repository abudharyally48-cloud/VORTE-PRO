// src/utils/concurrencyLimiter.js
// Runs at most `maxConcurrent` async tasks at once; extra tasks wait in a FIFO
// queue. If the queue itself is full, run() rejects with err.code ===
// "TOO_MANY_PENDING" so callers (see services/downloaders/index.js) can tell
// the user the bot is busy instead of piling up unbounded work.

class ConcurrencyLimiter {
  /**
   * @param {number} maxConcurrent  tasks allowed to run simultaneously (>=1)
   * @param {object} [opts]
   * @param {number} [opts.maxPending]  max tasks allowed to wait (default 20)
   */
  constructor(maxConcurrent = 3, opts = {}) {
    const n = Math.floor(Number(maxConcurrent));
    this.maxConcurrent = Number.isFinite(n) && n >= 1 ? n : 3;
    const p = Math.floor(Number(opts.maxPending));
    this.maxPending = Number.isFinite(p) && p >= 0 ? p : 20;
    this.active = 0;
    this.queue = [];
  }

  get pending() {
    return this.queue.length;
  }

  /**
   * Run `task` (a function returning a promise/value) under the limit.
   * Resolves/rejects with the task's own result.
   */
  run(task) {
    if (typeof task !== "function") {
      return Promise.reject(new TypeError("ConcurrencyLimiter.run expects a function"));
    }
    return new Promise((resolve, reject) => {
      const job = { task, resolve, reject };
      if (this.active < this.maxConcurrent) {
        this._start(job);
      } else if (this.queue.length < this.maxPending) {
        this.queue.push(job);
      } else {
        const err = new Error("Too many pending tasks");
        err.code = "TOO_MANY_PENDING";
        reject(err);
      }
    });
  }

  _start(job) {
    this.active++;
    let result;
    try {
      result = Promise.resolve(job.task());
    } catch (e) {
      result = Promise.reject(e);
    }
    result.then(job.resolve, job.reject).finally(() => {
      this.active--;
      const next = this.queue.shift();
      if (next) this._start(next);
    });
  }
}

module.exports = { ConcurrencyLimiter };
