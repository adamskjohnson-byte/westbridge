type AppLoaderOptions = {
  readyPromise?: Promise<unknown>
  minDelayMs?: number
  maxDelayMs?: number
  prefersReducedMotion?: boolean
  setTimeoutFn?: typeof setTimeout
  clearTimeoutFn?: typeof clearTimeout
  now?: () => number
}

export function startAppLoader(options: AppLoaderOptions = {}) {
  const loader = document.getElementById('app-loader')
  if (!loader) return Promise.resolve()

  const {
    minDelayMs = 600,
    maxDelayMs = 2500,
    prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    readyPromise = Promise.all([
      document.fonts?.ready ?? Promise.resolve(),
      new Promise<void>((resolve) => {
        if (document.readyState === 'complete') {
          resolve()
          return
        }

        window.addEventListener('load', () => resolve(), { once: true })
      }),
    ]),
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
    now = () => Date.now(),
  } = options

  const originalOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'

  let completed = false
  const timeoutId = setTimeoutFn(() => {
    complete()
  }, maxDelayMs)

  const complete = () => {
    if (completed) return
    completed = true
    clearTimeoutFn(timeoutId)

    loader.classList.add('is-hiding')
    setTimeoutFn(() => {
      loader.remove()
      document.body.style.overflow = originalOverflow
    }, prefersReducedMotion ? 0 : 400)

    window.dispatchEvent(new CustomEvent('app:ready'))
  }

  const start = now()
  const hideAfterReady = () => {
    const elapsed = now() - start
    const waitMs = prefersReducedMotion ? 0 : Math.max(0, minDelayMs - elapsed)
    setTimeoutFn(complete, waitMs)
  }

  Promise.resolve(readyPromise)
    .then(() => {
      hideAfterReady()
    })
    .catch(() => {
      complete()
    })

  return Promise.resolve()
}
