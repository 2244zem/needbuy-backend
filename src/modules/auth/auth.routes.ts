import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { authLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import * as controller from "./auth.controller";
import {
  authTokenParams,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  socialAuthSchema,
} from "./auth.schema";

export const authRouter = Router();

authRouter.post(
  "/register",
  authLimiter,
  validate({ body: registerSchema }),
  asyncHandler(controller.register)
);

authRouter.post(
  "/social",
  authLimiter,
  validate({ body: socialAuthSchema }),
  asyncHandler(controller.socialAuth)
);

authRouter.get("/google", authLimiter, asyncHandler(controller.googleRedirect));
authRouter.get("/google/callback", authLimiter, asyncHandler(controller.googleCallback));

authRouter.post(
  "/login",
  authLimiter,
  validate({ body: loginSchema }),
  asyncHandler(controller.login)
);

authRouter.post(
  "/refresh",
  authLimiter,
  validate({ body: refreshSchema }),
  asyncHandler(controller.refresh)
);

authRouter.post("/logout", validate({ body: refreshSchema }), asyncHandler(controller.logout));

authRouter.get("/me", requireAuth, asyncHandler(controller.me));

authRouter.post(
  "/verify-email/:token",
  authLimiter,
  validate({ params: authTokenParams }),
  asyncHandler(controller.verifyEmail)
);

authRouter.post("/resend-verification", authLimiter, requireAuth, asyncHandler(controller.resendVerification));

authRouter.post(
  "/forgot-password",
  authLimiter,
  validate({ body: forgotPasswordSchema }),
  asyncHandler(controller.forgotPassword)
);

authRouter.post(
  "/validate-reset-token/:token",
  authLimiter,
  validate({ params: authTokenParams }),
  asyncHandler(controller.validateResetToken)
);

authRouter.post(
  "/reset-password/:token",
  authLimiter,
  validate({ params: authTokenParams, body: resetPasswordSchema }),
  asyncHandler(controller.resetPassword)
);
