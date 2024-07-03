import { env } from "@/env";
import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: `${env.LOG_LOCATION}/error.log`,
      level: "error",
    }),
    new winston.transports.File({
      filename: `${env.LOG_LOCATION}/combined.log`,
    }),
  ],
});

export default logger;
