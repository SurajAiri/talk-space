import express from "express";
import { authorizeUser } from "./middlewares/authorization.middlewares.js";
import {
  errorHandler,
  notFoundHandler,
} from "./middlewares/error.middlewares.js";
import responseFormatter from "./middlewares/response.middlewares.js";
import router from "./routes/index.routes.js";

export const app = express();

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
