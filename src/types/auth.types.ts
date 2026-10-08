export interface RegisterRequest {
  email: string;
  password: string;
  confirm_password?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// Refresh credentials come from the HttpOnly cookie, not the JSON request body.
export type RefreshTokenRequest = Record<string, never>;

export interface OAuthRequest {
  id_token: string;
  access_token?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  is_active: boolean;
}

export interface JwtPayload {
  sub: string;
  sid: string;
}
