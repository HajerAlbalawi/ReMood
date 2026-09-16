import express, { type Express } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";

const app: Express = express();
app.set("trust proxy", 1);
const MAX_CONCURRENT_AI_REQUESTS = 4;
let activeAiRequests = 0;

const configuredOrigins = (process.env.ALLOWED_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const replitDevDomain = process.env.REPLIT_DEV_DOMAIN?.trim();
const allowedOrigins = new Set([
  ...configuredOrigins,
  "https://remood.replit.app",
  ...(replitDevDomain
    ? [
        `https://${replitDevDomain}`,
        `https://${replitDevDomain.replace(".pike.replit.dev", ".expo.pike.replit.dev")}`,
      ]
    : []),
]);

function limitAiConcurrency(
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  if (activeAiRequests >= MAX_CONCURRENT_AI_REQUESTS) {
    res.status(503).json({ error: "مساعد الكتب مشغول حالياً. حاول مرة أخرى بعد لحظات." });
    return;
  }

  activeAiRequests += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    activeAiRequests = Math.max(0, activeAiRequests - 1);
  };
  res.once("finish", release);
  res.once("close", release);
  next();
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin is not allowed by CORS"));
    },
  }),
);

// Rate limiting
app.use(
  "/api/recommendations",
  rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false }),
);
app.use(
  "/api/weather",
  rateLimit({ windowMs: 60_000, max: 60 }),
);
app.use(
  "/api/goodreads",
  rateLimit({ windowMs: 60_000, max: 8, standardHeaders: true, legacyHeaders: false }),
);
app.use(
  "/api/ai",
  rateLimit({ windowMs: 60_000, max: 8, standardHeaders: true, legacyHeaders: false }),
);
app.use("/api/ai", limitAiConcurrency);
app.use(cookieParser());
app.use(express.json({ limit: "128kb" }));
app.use(express.urlencoded({ extended: true, limit: "64kb", parameterLimit: 100 }));
app.use(authMiddleware);

app.use("/api", router);

export default app;
