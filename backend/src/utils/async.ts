/** Reject if a promise takes longer than `ms`. */
export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: NodeJS.Timeout;
  const timeout = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(Object.assign(new Error(`${label} timed out after ${ms}ms`), { isTimeout: true })), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t)) as Promise<T>;
}

/** Retry an async fn with linear backoff when `shouldRetry(err)` is true. */
export async function retry<T>(
  fn: () => Promise<T>,
  opts: { attempts: number; delayMs: number; shouldRetry: (e: unknown) => boolean },
): Promise<T> {
  let last: unknown;
  for (let i = 1; i <= opts.attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i === opts.attempts || !opts.shouldRetry(e)) break;
      await new Promise((r) => setTimeout(r, opts.delayMs * i));
    }
  }
  throw last;
}
