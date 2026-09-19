/**
 * Dispara as rotinas de cron contra o servidor em execução.
 * Uso: npm run cron:reminders | npm run cron:expire
 */
import "dotenv/config";

const job = process.argv[2];
if (job !== "reminders" && job !== "expire") {
  console.error("Uso: tsx scripts/cron.ts <reminders|expire>");
  process.exit(1);
}
const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const res = await fetch(`${base}/api/cron/${job}`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` } });
console.log(res.status, await res.text());
