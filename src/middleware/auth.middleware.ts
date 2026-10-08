import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";

export interface AuthRequest
  extends Request {
  user?: {
    user_id: string;
    session_id: string;
  };
}

export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader =
      req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization header required",
      });
    }

    const [type, token] =
      authHeader.split(" ");

    if (
      type !== "Bearer" ||
      !token
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid authorization format",
      });
    }

    const payload =
      verifyAccessToken(token);

    req.user = payload;

    next();

  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired access token",
    });
  }
}