import { db } from "@/server/db";
import winston from "winston";
import { config } from "@/server/db/schema";
import fs from "fs";
import { EventEmitter } from "events";
import "winston-daily-rotate-file";
import DailyRotateFile from "winston-daily-rotate-file";
interface LogLocationCache {
  location: string;
  lastChecked: number;
}

let logLocationCache: LogLocationCache | null = null;
const logLocationEmitter = new EventEmitter();
const CACHE_TTL = 60000; // 1 minute in milliseconds

export const getLogLocation = async (forceRefresh = false): Promise<string> => {
  const now = Date.now();

  if (
    !forceRefresh &&
    logLocationCache &&
    now - logLocationCache.lastChecked < CACHE_TTL
  ) {
    return logLocationCache.location;
  }

  const logLocation = await db.query.config.findFirst({
    where: (config, { eq }) => eq(config.name, "LOG_FILE_LOCATION"),
  });

  const loc = logLocation?.value ?? "./logs";

  if (!fs.existsSync(loc)) {
    fs.mkdirSync(loc, { recursive: true });
  }

  logLocationCache = { location: loc, lastChecked: now };
  logLocationEmitter.emit("locationUpdated", loc);

  return loc;
};

export const getLogHTTPSettings = async () => {
  const logHTTPSettingsJSON = await db.query.config.findFirst({
    where: (config, { eq }) => eq(config.name, "LOG_HTTP_SETTINGS"),
  });

  if (!logHTTPSettingsJSON) {
    return undefined;
  }

  const logHTTPSettings = JSON.parse(logHTTPSettingsJSON.value) as {
    host?: string;
    port?: number;
    path?: string;
    auth?: { username: string; password: string };
    ssl?: boolean;
    batch?: boolean;
    batchInterval?: number;
    batchCount?: number;
  };

  return logHTTPSettings;
};

export const updateLogLocation = async (newLocation: string): Promise<void> => {
  await db
    .insert(config)
    .values({ name: "LOG_LOCATION", value: newLocation })
    .onConflictDoUpdate({
      target: config.name,
      set: { value: newLocation },
    });

  await getLogLocation(true); // Force refresh the cache
};

// Create a dynamic transport that updates when the log location changes
const createDynamicFileTransport = (filename: string, level?: string) => {
  let transport = new winston.transports.DailyRotateFile({
    filename: `${logLocationCache?.location}/${filename}`,
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "30d",
    level: level ?? "info",
  });

  logLocationEmitter.on("locationUpdated", (newLocation) => {
    transport.filename = `${newLocation}/${filename}`;
  });

  return transport;
};

const httpSettings = await getLogHTTPSettings();

const getTransports = () => {
  const transports: (
    | winston.transports.ConsoleTransportInstance
    | winston.transports.HttpTransportInstance
    | DailyRotateFile
  )[] = [
    new winston.transports.Console(),
    createDynamicFileTransport("error.log", "error"),
    createDynamicFileTransport("combined.log"),
  ];

  if (httpSettings) {
    transports.push(new winston.transports.Http(httpSettings));
  }

  return transports;
};
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: getTransports(),
});

// Initialize the log location
getLogLocation();

export default logger;
