import { Request, Response } from "express";

import * as authService
  from "../services/auth.service";

import { AuthRequest }
  from "../middleware/auth.middleware";

export async function register(
  req: Request,
  res: Response
) {
  try {
    const {
      email,
      password,
      confirm_password,
    } = req.body;

    if (
      !email ||
      !password ||
      !confirm_password
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    if (
      password !== confirm_password
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password confirmation does not match",
      });
    }

    const user =
      await authService.register(
        email,
        password
      );

    return res.status(201).json({
      success: true,
      message:
        "User registered successfully",
      data: {
        user_id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
    });

  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

export async function login(
  req: Request,
  res: Response
) {
  try {
    const {
      email,
      password,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required",
      });
    }

    const userAgent =
      req.headers["user-agent"] || null;

    const ipAddress =
      req.ip || null;

    const result =
      await authService.login(
        email,
        password,
        null,
        ipAddress,
        userAgent
      );

    return res.status(200).json({
      success: true,
      data: result,
    });

  } catch (error: any) {
    return res.status(401).json({
      success: false,
      message: error.message,
    });
  }
}

export async function refreshToken(
  req: Request,
  res: Response
) {
  try {
    const {
      refresh_token,
    } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        message:
          "Refresh token is required",
      });
    }

    const result =
      await authService.refreshToken(
        refresh_token
      );

    return res.status(200).json({
      success: true,
      data: result,
    });

  } catch (error: any) {
    return res.status(401).json({
      success: false,
      message: error.message,
    });
  }
}

export async function logout(
  req: AuthRequest,
  res: Response
) {
  try {
    await authService.logout(
      req.user!.session_id
    );

    return res.status(200).json({
      success: true,
      message:
        "Successfully logged out from current session",
    });

  } catch {
    return res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
}

export async function getSessions(
  req: AuthRequest,
  res: Response
) {
  try {
    const sessions =
      await authService.getSessions(
        req.user!.user_id,
        req.user!.session_id
      );

    return res.status(200).json({
      success: true,
      data: sessions,
    });

  } catch {
    return res.status(500).json({
      success: false,
      message:
        "Failed to get sessions",
    });
  }
}

export async function forceLogout(
  req: AuthRequest,
  res: Response
) {
  try {
    const { id } = req.params;

if (!id || Array.isArray(id)) {
  return res.status(400).json({
    success: false,
    message: "Invalid session id",
  });
}

const revoked =
  await authService.forceLogout(
    req.user!.user_id,
    id
  );

  } catch {
    return res.status(500).json({
      success: false,
      message:
        "Failed to revoke session",
    });
  }
}

export async function oauthLogin(
  req: Request,
  res: Response
) {
  return res.status(501).json({
    success: false,
    message:
      "OAuth login is not implemented yet",
  });
}