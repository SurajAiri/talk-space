import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import responseFormatter from "./src/middlewares/response.middlewares.js";
import { authorizeUser } from "./src/middlewares/authorization.middlewares.js";
import router from "./src/routes/index.routes.js";

const app = express();
const PORT = process.env.PORT || 3000;

// middlewares
app.use(express.json());
app.use(responseFormatter);
app.use(authorizeUser);

// routes
app.use("/api/v1", router);

// Server start
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// MongoDB connection
const mongoURI =
  process.env.MONGO_URI || "mongodb://localhost:27017/open_alert";

mongoose
  .connect(mongoURI)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
  });
