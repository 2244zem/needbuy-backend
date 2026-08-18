import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import * as controller from "./controller";

export const adminPublicRouter = Router();

adminPublicRouter.get("/admin-profile/:id", asyncHandler(controller.getPublicProfile));

adminPublicRouter.get("/settings", asyncHandler(controller.getPublicSettings));
