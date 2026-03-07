import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Generate daily lesson plans every weekday at 6:00 AM UTC
// (Adjust the hour to match your local morning — UTC-5 = 11 AM UTC for 6 AM EST,
//  UTC-7 = 13:00 UTC for 6 AM MST, etc.)
crons.weekly(
  "generate daily plans - Monday",
  { dayOfWeek: "monday", hourUTC: 11, minuteUTC: 0 },
  internal.planGenerator.generateDailyPlans
);

crons.weekly(
  "generate daily plans - Tuesday",
  { dayOfWeek: "tuesday", hourUTC: 11, minuteUTC: 0 },
  internal.planGenerator.generateDailyPlans
);

crons.weekly(
  "generate daily plans - Wednesday",
  { dayOfWeek: "wednesday", hourUTC: 11, minuteUTC: 0 },
  internal.planGenerator.generateDailyPlans
);

crons.weekly(
  "generate daily plans - Thursday",
  { dayOfWeek: "thursday", hourUTC: 11, minuteUTC: 0 },
  internal.planGenerator.generateDailyPlans
);

crons.weekly(
  "generate daily plans - Friday",
  { dayOfWeek: "friday", hourUTC: 11, minuteUTC: 0 },
  internal.planGenerator.generateDailyPlans
);

export default crons;
