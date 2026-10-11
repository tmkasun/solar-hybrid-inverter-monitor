export const updateCheckInterval = 60 * 60 * 1000;

/** Discover waiting workers even after a deferred update or another tab's check. */
export function startUpdateChecks(registration: ServiceWorkerRegistration, onWaiting: () => void): () => void {
  let stopped = false;
  let checking = false;
  const observedWorkers = new Set<ServiceWorker>();
  const reportWaiting = () => {
    // A first installation has no controller and must not show an update prompt.
    if (!stopped && registration.waiting && navigator.serviceWorker.controller) onWaiting();
  };
  const watchInstalling = () => {
    const worker = registration.installing;
    if (worker && !observedWorkers.has(worker)) {
      observedWorkers.add(worker);
      worker.addEventListener("statechange", reportWaiting);
    }
    reportWaiting();
  };
  const check = async () => {
    reportWaiting();
    if (stopped || checking || !navigator.onLine || document.visibilityState === "hidden" || registration.installing) return;
    checking = true;
    try {
      await registration.update();
      reportWaiting();
    } catch {
      // An unreachable frontend should not interrupt the current app session.
    } finally {
      checking = false;
    }
  };
  registration.addEventListener("updatefound", watchInstalling);
  document.addEventListener("visibilitychange", check);
  window.addEventListener("online", check);
  const timer = window.setInterval(check, updateCheckInterval);
  watchInstalling();
  void check();
  return () => {
    stopped = true;
    window.clearInterval(timer);
    registration.removeEventListener("updatefound", watchInstalling);
    document.removeEventListener("visibilitychange", check);
    window.removeEventListener("online", check);
    observedWorkers.forEach(worker => worker.removeEventListener("statechange", reportWaiting));
  };
}
