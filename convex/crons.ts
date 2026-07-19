import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.weekly(
  "sample queries for human review",
  { dayOfWeek: "monday", hourUTC: 9, minuteUTC: 0 },
  internal.observability.sampleForReview,
  { percentage: 10 },
);

export default crons;
