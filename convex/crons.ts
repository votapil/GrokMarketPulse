/**
 * T-31: periodic monitor. Convex skips overlapping runs of the same cron.
 * Does not touch mockSite — only scan.run → Firecrawl on whatever variant is live.
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Stage overnight: swap the line below for this one so the public URL
// does not scrape every 30 minutes while nobody is watching.
// crons.interval("monitor", { hours: 12 }, internal.scan.scanAll, {});
crons.interval("monitor", { minutes: 30 }, internal.scan.scanAll, {});

export default crons;
