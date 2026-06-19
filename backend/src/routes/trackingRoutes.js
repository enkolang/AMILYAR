import { Router } from "express";
import { trackConsent, trackPageView } from "../controllers/trackingController.js";

export const trackingRouter = Router();

trackingRouter.post("/consent", trackConsent);
trackingRouter.post("/page-view", trackPageView);
