import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as controller from "./controller";
import { listNotificationsQuery, notificationIdParams } from "./schema";

export const notificationsRouter = Router();

notificationsRouter.get(
  "/",
  requireAuth,
  validate({ query: listNotificationsQuery }),
  asyncHandler(controller.list)
);

notificationsRouter.get("/unread-count", requireAuth, asyncHandler(controller.unreadCount));

notificationsRouter.patch("/read-all", requireAuth, asyncHandler(controller.readAll));

notificationsRouter.patch(
  "/:id/read",
  requireAuth,
  validate({ params: notificationIdParams }),
  asyncHandler(controller.readOne)
);
