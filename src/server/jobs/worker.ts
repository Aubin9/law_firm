import { processEventReminders, processOverdueTasks } from "@/server/services/notification-service";
import { checkMissingBackupsJob } from "@/server/services/backup-service";

// Background worker process (npm run worker)
async function startWorker() {
  console.log("👷 Background worker process started (Law Practice Management Platform)...");

  // Scheduled periodic scanner for reminders and tasks (every 60 seconds)
  const runScanners = async () => {
    try {
      const now = new Date();
      const remindersResult = await processEventReminders(now);
      if (remindersResult.processedCount > 0) {
        console.log(`⏰ [Worker] Processed ${remindersResult.processedCount} event reminder(s).`);
      }

      const overdueResult = await processOverdueTasks(now);
      if (overdueResult.notifiedCount > 0) {
        console.log(`📋 [Worker] Processed ${overdueResult.notifiedCount} overdue task notification(s).`);
      }

      // Check backup freshness (Step 20)
      const backupCheck = await checkMissingBackupsJob();
      if (backupCheck.alertRaised) {
        console.warn("⚠️ [Worker] Missing daily backup alert raised (RPO violation).");
      }
    } catch (err) {
      console.error("❌ [Worker] Error running background scanners:", err);
    }
  };

  // Run on startup
  await runScanners();

  // Periodic interval (every 60s)
  setInterval(runScanners, 60_000);
}

startWorker().catch((err) => {
  console.error("Worker process error:", err);
  process.exit(1);
});
