// Starts the background job worker once per server process. Set WORKER_DISABLED=1 to run jobs only via /api/jobs/tick.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build" || process.env.WORKER_DISABLED === "1") return;
  const { startWorker } = await import("./lib/worker");
  startWorker();
}
