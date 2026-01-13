/**
 * OAuth2 authentication manager for UnoPim
 * Handles token acquisition, caching, and automatic refresh
 */

import type { TokenResponse, TokenCache, OAuthCredentials } from '../types/oauth.js';

export class OAuthManager {
  private baseUrl: string;
  private credentials: OAuthCredentials;
  private tokenCache: TokenCache | null = null;

  // Refresh token 5 minutes before expiry
  private readonly REFRESH_BUFFER_MS = 5 * 60 * 1000;

  // Retry configuration
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [0, 1000, 3000]; // immediate, 1s, 3s

  constructor(baseUrl: string, credentials: OAuthCredentials) {
    this.baseUrl = baseUrl;
    this.credentials = credentials;
  }

  /**
   * Gets a valid access token, refreshing if necessary
   * @returns Valid access token
   * @throws Error if authentication fails
   */
  async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.tokenCache && this.isTokenValid()) {
      return this.tokenCache.accessToken;
    }

    // Check if we should proactively refresh
    if (this.tokenCache && this.shouldRefresh()) {
      try {
        await this.refreshToken();
        return this.tokenCache!.accessToken;
      } catch (error) {
        // If refresh fails, try to get a new token
        console.error('Token refresh failed, acquiring new token:', error);
        await this.acquireToken();
        return this.tokenCache!.accessToken;
      }
    }

    // No valid token, acquire new one
    await this.acquireToken();
    return this.tokenCache!.accessToken;
  }

  /**
   * Acquires a new access token using password grant flow
   * @throws Error if authentication fails after retries
   */
  private async acquireToken(): Promise<void> {
    const credentials = Buffer.from(
      `${this.credentials.clientId}:${this.credentials.clientSecret}`
    ).toString('base64');

    const body = {
      username: this.credentials.username,
      password: this.credentials.password,
      grant_type: 'password',
    };

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          await this.sleep(this.RETRY_DELAYS[attempt]);
        }

        const response = await fetch(`${this.baseUrl}/oauth/token`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `OAuth token request failed: ${response.status} ${response.statusText}\n${errorText}`
          );
        }

        const tokenResponse = await response.json() as TokenResponse;
        this.cacheToken(tokenResponse);
        return;

      } catch (error) {
        if (attempt === this.MAX_RETRIES - 1) {
          throw new Error(
            `Failed to acquire OAuth token after ${this.MAX_RETRIES} attempts: ${error}`
          );
        }
        console.error(`Token acquisition attempt ${attempt + 1} failed:`, error);
      }
    }
  }

  /**
   * Refreshes the access token using the refresh token
   * @throws Error if refresh fails
   */
  private async refreshToken(): Promise<void> {
    if (!this.tokenCache) {
      throw new Error('No token cache available for refresh');
    }

    const credentials = Buffer.from(
      `${this.credentials.clientId}:${this.credentials.clientSecret}`
    ).toString('base64');

    const body = {
      refresh_token: this.tokenCache.refreshToken,
      grant_type: 'refresh_token',
    };

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          await this.sleep(this.RETRY_DELAYS[attempt]);
        }

        const response = await fetch(`${this.baseUrl}/oauth/token`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Token refresh failed: ${response.status} ${response.statusText}\n${errorText}`
          );
        }

        const tokenResponse = await response.json() as TokenResponse;
        this.cacheToken(tokenResponse);
        return;

      } catch (error) {
        if (attempt === this.MAX_RETRIES - 1) {
          throw new Error(
            `Failed to refresh token after ${this.MAX_RETRIES} attempts: ${error}`
          );
        }
        console.error(`Token refresh attempt ${attempt + 1} failed:`, error);
      }
    }
  }

  /**
   * Caches a token response
   */
  private cacheToken(tokenResponse: TokenResponse): void {
    const expiresAt = Date.now() + (tokenResponse.expires_in * 1000);

    this.tokenCache = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt,
    };
  }

  /**
   * Checks if the cached token is still valid
   */
  private isTokenValid(): boolean {
    if (!this.tokenCache) {
      return false;
    }
    return Date.now() < this.tokenCache.expiresAt;
  }

  /**
   * Checks if we should proactively refresh the token
   */
  private shouldRefresh(): boolean {
    if (!this.tokenCache) {
      return false;
    }
    return Date.now() >= (this.tokenCache.expiresAt - this.REFRESH_BUFFER_MS);
  }

  /**
   * Clears the token cache (useful for testing or logout)
   */
  clearCache(): void {
    this.tokenCache = null;
  }

  /**
   * Helper function to sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
