/** Bound provider waits and release callers immediately when their turn is canceled. */
export function waitForAudio<T>(pending: Promise<T>, signal: AbortSignal, timeoutMs = 10000): Promise<T> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort) }
    const abort = () => { cleanup(); reject(new Error('Audio operation cancelled')) }
    const timer = setTimeout(() => { cleanup(); reject(new Error('Audio operation timed out')) }, timeoutMs)
    signal.addEventListener('abort', abort, { once: true })
    pending.then(value => { cleanup(); resolve(value) }, error => { cleanup(); reject(error) })
  })
}
