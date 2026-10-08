import { Router } from "express";

import {
  register,
  login,
  oauthLogin,
  refreshToken,
  logout,
  getSessions,
  forceLogout,
} from "../controllers/auth.controller";

import {
  authenticate,
} from "../middleware/auth.middleware";

const router = Router();

router.post(
  "/register",
  register
);

router.post(
  "/login",
  login
);

router.post(
  "/oauth/:provider",
  oauthLogin
);

router.post(
  "/refresh-token",
  refreshToken
);

router.post(
  "/logout",
  authenticate,
  logout
);

router.get(
  "/sessions",
  authenticate,
  getSessions
);

router.delete(
  "/sessions/:id",
  authenticate,
  forceLogout
);

export default router;