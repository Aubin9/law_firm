// Background worker process (npm run worker)
async function startWorker() {
  console.log("👷 Background worker process started...");
  // pg-boss worker initialization will be wired in Step 15/17
}

startWorker().catch((err) => {
  console.error("Worker error:", err);
  process.exit(1);
});

