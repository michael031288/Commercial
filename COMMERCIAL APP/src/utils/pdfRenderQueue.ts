// PDF Render Queue - Limits concurrent PDF renders to prevent worker race conditions

type RenderTask = () => Promise<void>;

class PDFRenderQueue {
  private queue: RenderTask[] = [];
  private running = 0;
  private maxConcurrent = 2; // Process 2 PDFs at a time
  private processing = false;

  async enqueue(task: RenderTask): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          await task();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0 && this.running < this.maxConcurrent) {
      const task = this.queue.shift();
      if (!task) break;

      this.running++;
      task()
        .catch((error) => {
          console.error('PDF render queue task error:', error);
        })
        .finally(() => {
          this.running--;
          // Process next task after a small delay
          setTimeout(() => this.process(), 100);
        });
    }

    this.processing = false;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getRunningCount(): number {
    return this.running;
  }
}

export const pdfRenderQueue = new PDFRenderQueue();

