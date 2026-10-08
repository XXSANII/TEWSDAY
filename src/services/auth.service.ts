import {
  findUserByEmail,
  findUserById,
  createUser,
} from "../repositories/user.repository";

import {
  createLocalProvider,
  findLocalProvider,
} from "../repositories/auth-provider.repository";

import {
  createSession,
  findSessionByRefreshTokenHash,
  revokeSession,
  updateRefreshToken,
  getUserSessions,
  revokeUserSession,
} from "../repositories/session.repository";

import {
  hashPassword,
  comparePassword,
} from "../utils/password";

import {
  generateAccessToken,
} from "../utils/jwt";

import {
  generateRefreshToken,
  hashRefreshToken,
} from "../utils/token";

function getRefreshTokenExpiration(): Date {
  const date = new Date();

  date.setDate(
    date.getDate() + 30
  );

  return date;
}

export async function register(
  email: string,
  password: string
) {
  const existingUser =
    await findUserByEmail(email);

  if (existingUser) {
    throw new Error(
      "Email already registered"
    );
  }

  const user =
    await createUser(email);

  const passwordHash =
    await hashPassword(password);

  await createLocalProvider(
    user.id,
    passwordHash
  );

  return user;
}

export async function login(
  email: string,
  password: string,
  deviceName: string | null,
  ipAddress: string | null,
  userAgent: string | null
) {
  const user =
    await findUserByEmail(email);

  if (!user) {
    throw new Error(
      "Invalid email or password"
    );
  }

  if (!user.is_active) {
    throw new Error(
      "User account is inactive"
    );
  }

  const provider =
    await findLocalProvider(user.id);

  if (!provider) {
    throw new Error(
      "Local login is not available"
    );
  }

  const validPassword =
    await comparePassword(
      password,
      provider.password_hash
    );

  if (!validPassword) {
    throw new Error(
      "Invalid email or password"
    );
  }

  const refreshToken =
    generateRefreshToken();

  const refreshTokenHash =
    hashRefreshToken(refreshToken);

  const expiresAt =
    getRefreshTokenExpiration();

  const session =
    await createSession(
      user.id,
      refreshTokenHash,
      deviceName,
      ipAddress,
      userAgent,
      expiresAt
    );

  const accessToken =
    generateAccessToken(
      user.id,
      session.id
    );

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: 3600,
  };
}

export async function refreshToken(
  refreshToken: string
) {
  const refreshTokenHash =
    hashRefreshToken(refreshToken);

  const session =
    await findSessionByRefreshTokenHash(
      refreshTokenHash
    );

  if (!session) {
    throw new Error(
      "Invalid refresh token"
    );
  }

  const user =
    await findUserById(
      session.user_id
    );

  if (!user || !user.is_active) {
    throw new Error(
      "User account is inactive"
    );
  }

  const newRefreshToken =
    generateRefreshToken();

  const newRefreshTokenHash =
    hashRefreshToken(
      newRefreshToken
    );

  const expiresAt =
    getRefreshTokenExpiration();

  await updateRefreshToken(
    session.id,
    newRefreshTokenHash,
    expiresAt
  );

  const accessToken =
    generateAccessToken(
      user.id,
      session.id
    );

  return {
    access_token: accessToken,
    refresh_token: newRefreshToken,
    token_type: "Bearer",
    expires_in: 3600,
  };
}

export async function logout(
  sessionId: string
) {
  await revokeSession(sessionId);
}

export async function getSessions(
  userId: string,
  currentSessionId: string
) {
  const sessions =
    await getUserSessions(userId);

  return sessions.map(
  (session: {
    id: string;
    device: string | null;
    ip_address: string | null;
    last_active: Date;
  }) => ({
    ...session,
    is_current:
      session.id === currentSessionId,
  })
);
}

export async function forceLogout(
  userId: string,
  sessionId: string
) {
  return revokeUserSession(
    userId,
    sessionId
  );
}