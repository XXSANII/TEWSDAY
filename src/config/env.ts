import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT) || 3000,

  databaseUrl: process.env.DATABASE_URL || "",

  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "",

  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "1h",

  refreshTokenExpiresIn:
    process.env.REFRESH_TOKEN_EXPIRES_IN || "30d",
};