import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "revalidate connected domains",
  { minutes: 15 },
  internal.domainHealth.scheduleDue,
  {},
);

export default crons;
