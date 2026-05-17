export class AsyncSemaphore {
  constructor(limit) {
    this.limit = limit;
    this.inUse = 0;
    this.queue = [];
  }

  async withPermit(fn) {
    if (this.inUse >= this.limit) {
      await new Promise((resolve) => this.queue.push(resolve));
    }
    this.inUse += 1;
    try {
      return await fn();
    } finally {
      this.inUse -= 1;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}
