import { toNodeHandler } from "better-auth/node";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { googleAuth } from "./lib/better-auth.js";
import { authorizeUser } from "./middlewares/authorization.middlewares.js";
import {
  errorHandler,
  notFoundHandler,
} from "./middlewares/error.middlewares.js";
import responseFormatter from "./middlewares/response.middlewares.js";
import router from "./routes/index.routes.js";

export const app = express();

app.disable("x-powered-by");
// How many reverse proxies sit in front (nginx, a load balancer...). Without this
// every request appears to come from the proxy and per-IP limits hit everyone at once.
if (env.TRUST_PROXY > 0) app.set("trust proxy", env.TRUST_PROXY);

app.use(helmet());

// The web app lives on its own origin (WEB_URL) and calls this API directly from the browser.
// Only that exact origin is granted access; every other origin gets no CORS headers at all and
// is refused by the browser. Credentials are allowed for it because the Google sign-in
// handshake relies on a short-lived cookie.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && origin === env.WEB_URL) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
      res.setHeader("Access-Control-Max-Age", "600");
      return void res.sendStatus(204);
    }
  }
  next();
});

// better-auth (Google handshake only) must be mounted BEFORE express.json()
if (env.GOOGLE_ENABLED) {
  app.all("/api/v1/better-auth/*splat", toNodeHandler(googleAuth));
}

// middlewares
// responseFormatter goes first: body-parser errors (too large, malformed JSON) are
// answered through it, so it must already be installed when they happen.
app.use(responseFormatter);
app.use(express.json({ limit: "32kb" }));
app.use(authorizeUser);

// routes
app.get("/", (req, res) => {
  res.sendResponse(200, {
    status: "success",
    message: "Welcome to the API",
  });
});
app.get("/health", (req, res) => {
  res.sendResponse(200, {
    status: "success",
    message: "API is healthy",
  });
});
app.use("/api/v1", router);

// fallbacks (must be last)
app.use(notFoundHandler);
app.use(errorHandler);
