/**
 * OAuth2 type definitions for UnoPim authentication
 */

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface TokenCache {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
}

export interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}
