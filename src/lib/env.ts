import { z } from "zod";

const booleanString = z
  .string()
  .transform((val) => val === "true" || val === "1")
  .or(z.boolean());

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DEFAULT_LOCALE: z.enum(["fr", "en"]).default("fr"),
  TZ: z.string().default("Africa/Douala"),
  NEXT_TELEMETRY_DISABLED: z.string().default("1"),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Authentication
  BETTER_AUTH_SECRET: z.string().min(1).default("dev-secret-key-at-least-32-chars-long"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  SESSION_IDLE_MINUTES: z.coerce.number().int().positive().default(30),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),
  TWO_FACTOR_REQUIRED_ROLES: z.string().default("PARTNER,LEAD_LAWYER,ASSOCIATE_LAWYER,TECHNICAL_ADMIN,FUNCTIONAL_ADMIN,ACCOUNTANT"),

  // Storage
  STORAGE_PROVIDER: z.enum(["local", "cloudflare"]).default("local"),
  STORAGE_LOCAL_PATH: z.string().default("./storage"),
  STORAGE_MAX_UPLOAD_MB: z.coerce.number().int().positive().default(100),
  STORAGE_ALLOWED_MIME: z.string().default(
    "application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain"
  ),
  CLOUDFLARE_R2_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_R2_ACCESS_KEY_ID: z.string().optional(),
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string().optional(),
  CLOUDFLARE_R2_BUCKET: z.string().optional(),

  // Antivirus
  CLAMAV_HOST: z.string().default("localhost"),
  CLAMAV_PORT: z.coerce.number().int().default(3310),

  // Background jobs
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(4),

  // Backups
  BACKUP_REPOSITORY_PATH: z.string().default("./backups"),
  BACKUP_PASSPHRASE_FILE: z.string().optional(),
  BACKUP_RETENTION_DAILY: z.coerce.number().int().positive().default(14),
  BACKUP_RETENTION_WEEKLY: z.coerce.number().int().positive().default(8),
  BACKUP_RETENTION_MONTHLY: z.coerce.number().int().positive().default(12),

  // Integrations (OFF by default)
  DRIVE_SYNC_ENABLED: booleanString.default(false),
  DRIVE_CREDENTIALS_FILE: z.string().optional(),
  DRIVE_REMOTE_FOLDER: z.string().optional(),

  AI_ENABLED: booleanString.default(false),
  OPENAI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  AI_MAX_INPUT_CHARS: z.coerce.number().int().positive().default(20000),
  AI_BLOCKED_CONFIDENTIALITY: z.string().default("RESTRICTED,STRICT"),

  // Email (Resend)
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().default("onboarding@resend.dev"),

  // Logging
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("❌ Invalid environment variables:");
    for (const error of result.error.errors) {
      console.error(`   - ${error.path.join(".")}: ${error.message}`);
    }
    throw new Error(
      `Invalid environment configuration. Missing or invalid variables:\n` +
        result.error.errors.map((e) => `• ${e.path.join(".")}: ${e.message}`).join("\n")
    );
  }
  return result.data;
}

export const env = validateEnv();

