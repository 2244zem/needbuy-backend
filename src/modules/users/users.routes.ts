import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { authLimiter, writeLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import * as controller from "./users.controller";
import { changePasswordSchema, setPasswordSchema, updateProfileSchema } from "./users.schema";

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get("/me", asyncHandler(controller.getMe));

usersRouter.patch(
  "/me",
  writeLimiter,
  validate({ body: updateProfileSchema }),
  asyncHandler(controller.updateMe)
);

usersRouter.post(
  "/me/set-password",
  authLimiter,
  validate({ body: setPasswordSchema }),
  asyncHandler(controller.setPassword)
);

usersRouter.post(
  "/me/change-password",
  authLimiter,
  validate({ body: changePasswordSchema }),
  asyncHandler(controller.changePassword)
);
