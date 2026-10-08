export interface RegisterRequest {
  email: string;
  password: string;
  confirm_password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

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
  user_id: string;
  session_id: string;
}