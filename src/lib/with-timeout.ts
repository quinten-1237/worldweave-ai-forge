/**
 * Wraps a promise with a timeout. Rejects with a friendly Dutch error if the
 * underlying promise hasn't settled within `ms` milliseconds.
 */
export function withTimeout<T>(promise: Promise<T>, ms = 15000, label = "server-functie"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Time-out: ${label} reageerde niet binnen ${Math.round(ms / 1000)}s.`));
    }, ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}
