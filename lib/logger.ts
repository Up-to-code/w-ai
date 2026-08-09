type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

// Single switch for the whole app. Set LOG_LEVEL=error in production to
// silence debug/info noise; LOG_LEVEL=debug for local development.
const activeLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === "production" ? "error" : "info");

function enabled(level: LogLevel) {
  return LEVELS[level] >= LEVELS[activeLevel];
}

function format(args: unknown[]) {
  return args
    .map((a) => {
      if (typeof a === "string") return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ");
}

export const logger = {
  debug: (...args: unknown[]) => enabled("debug") && console.debug(`[qentrah]`, format(args)),
  info: (...args: unknown[]) => enabled("info") && console.info(`[qentrah]`, format(args)),
  warn: (...args: unknown[]) => enabled("warn") && console.warn(`[qentrah]`, format(args)),
  error: (...args: unknown[]) => enabled("error") && console.error(`[qentrah]`, format(args)),
};

export function withLogger<T>(context: string) {
  return {
    error: (...args: unknown[]) => logger.error(`[${context}]`, ...args),
    warn: (...args: unknown[]) => logger.warn(`[${context}]`, ...args),
  };
}
