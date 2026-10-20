export interface ReviewBatchResult {
  results: { id: string }[];
  failed: { id: string; error: string }[];
  fatalError?: string;
}
export interface ReviewProgress {
  total: number;
  completed: number;
  failed: { id: string; error: string }[];
  stopped: boolean;
}

export async function runGrantReview(ids: string[], options: {
  review: (ids: string[]) => Promise<ReviewBatchResult>;
  onProgress: (progress: ReviewProgress) => void;
  shouldStop: () => boolean;
}): Promise<ReviewProgress> {
  const queue = [...new Set(ids)];
  const progress: ReviewProgress = { total: queue.length, completed: 0, failed: [], stopped: false };
  options.onProgress({ ...progress, failed: [] });
  let cursor = 0;
  let fatal: unknown;
  async function worker() {
    while (cursor < queue.length && !options.shouldStop() && !fatal) {
      const batch = queue.slice(cursor, cursor + 8);
      cursor += batch.length;
      try {
        const result = await options.review(batch);
        const done = new Set(result.results.map(r => r.id));
        for (const id of batch) {
          if (done.has(id)) progress.completed++;
          else progress.failed.push({ id, error: result.failed.find(r => r.id === id)?.error ?? "The review result was missing" });
        }
        if (result.fatalError) fatal = new Error(result.fatalError);
      } catch (error) {
        // Authentication, configuration and transport failures stop scheduling;
        // do not turn one outage into dozens of failed paid requests.
        fatal = error;
        progress.failed.push(...batch.map(id => ({ id, error: error instanceof Error ? error.message : "Request failed" })));
      }
      options.onProgress({ ...progress, failed: [...progress.failed] });
    }
  }
  await Promise.all(Array.from({ length: 4 }, () => worker()));
  progress.stopped = options.shouldStop() || !!fatal;
  options.onProgress({ ...progress, failed: [...progress.failed] });
  if (fatal) throw fatal;
  return progress;
}
