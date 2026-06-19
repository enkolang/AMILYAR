import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { trackingRouter } from "./routes/trackingRoutes.js";

dotenv.config();

export const app = express();

app.set("trust proxy", true);
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") ?? true,
    credentials: true,
  })
);
app.use(express.json({ limit: "200kb" }));

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

app.use("/api/tracking", rateLimit, trackingRouter);

app.use(errorHandler);
