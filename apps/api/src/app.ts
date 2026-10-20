import { toNodeHandler } from "better-auth/node";
import express from "express";
import { googleAuth } from "./lib/better-auth.js";
import { authorizeUser } from "./middlewares/authorization.middlewares.js";
import {
  errorHandler,
  notFoundHandler,
} from "./middlewares/error.middlewares.js";
import responseFormatter from "./middlewares/response.middlewares.js";
import router from "./routes/index.routes.js";

export const app = express();

// better-auth (Google handshake only) must be mounted BEFORE express.json()
app.all("/api/v1/better-auth/*splat", toNodeHandler(googleAuth));

// middlewares
app.use(express.json());
app.use(responseFormatter);
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
