import jwt from "jsonwebtoken";
import { env } from "../config/env";

export function generateAccessToken(
  userId: string,
  sessionId: string
): string {
  return jwt.sign(
    {
      user_id: userId,
      session_id: sessionId,
    },
    env.jwtAccessSecret,
    {
      expiresIn: env.jwtAccessExpiresIn,
    } as jwt.SignOptions
  );
}

export function verifyAccessToken(
  token: string
) {
  return jwt.verify(
    token,
    env.jwtAccessSecret
  ) as {
    user_id: string;
    session_id: string;
  };
}