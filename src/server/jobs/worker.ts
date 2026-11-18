import {
  processEventReminders,
  processOverdueTasks,
  processOverdueInvoices,
} from "@/server/services/notification-service";
import { checkMissingBackupsJob } from "@/server/services/backup-service";
import { scanPendingDocumentVersionsJob } from "@/server/storage/antivirus";

// Background worker process (npm run worker)
async function startWorker() {
  console.log("👷 Background worker process started (Law Practice Management Platform)...");

  // Scheduled periodic scanner for reminders, tasks, invoices, quarantine scans, and backup checks
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

      const overdueInvoices = await processOverdueInvoices(now);
      if (overdueInvoices.notifiedCount > 0) {
        console.log(`💳 [Worker] Processed ${overdueInvoices.notifiedCount} overdue invoice notification(s).`);
      }

      const avScan = await scanPendingDocumentVersionsJob();
      if (avScan.scannedCount > 0) {
        console.log(
          `🛡️ [Worker] Scanned ${avScan.scannedCount} quarantined document(s) (Clean: ${avScan.cleanCount}, Infected: ${avScan.infectedCount}).`
        );
      }

      const backupCheck = await checkMissingBackupsJob();
      if (backupCheck.alertRaised) {
        console.warn("⚠️ [Worker] Missing daily backup alert raised (RPO violation).");
      }
    } catch (err) {
      console.error("❌ [Worker] Error running background scanners:", err);
    }
  };

  await runScanners();
  setInterval(runScanners, 60_000);
}

startWorker().catch((err) => {
  console.error("Worker process error:", err);
  process.exit(1);
});
