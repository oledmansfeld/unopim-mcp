/**
 * UnoPim HTTP Client
 * Handles all API communication with UnoPim REST API
 */

import type { OAuthManager } from '../auth/oauth.js';
import { UnoPimApiError } from '../types/errors.js';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    current_page: number;
    from: number;
    last_page: number;
    per_page: number;
    to: number;
    total: number;
  };
  links?: {
    first?: string;
    last?: string;
    prev?: string;
    next?: string;
  };
}

export class UnoPimClient {
  private baseUrl: string;
  private authManager: OAuthManager;
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [0, 1000, 3000]; // immediate, 1s, 3s

  constructor(baseUrl: string, authManager: OAuthManager) {
    // Normalize base URL (remove trailing slash)
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.authManager = authManager;
  }

  /**
   * Makes a GET request to the UnoPim API
   */
  async get<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * Makes a POST request to the UnoPim API
   */
  async post<T>(endpoint: string, body: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  /**
   * Makes a PUT request to the UnoPim API
   */
  async put<T>(endpoint: string, body: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  /**
   * Makes a PATCH request to the UnoPim API
   */
  async patch<T>(endpoint: string, body: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  /**
   * Makes a DELETE request to the UnoPim API
   */
  async delete<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Makes a request to the UnoPim API with automatic retry and token refresh
   */
  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {}, timeout = this.DEFAULT_TIMEOUT } = options;

    // Normalize endpoint (ensure it starts with /)
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${normalizedEndpoint}`;

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        // Add delay for retries
        if (attempt > 0) {
          await this.sleep(this.RETRY_DELAYS[attempt]);
        }

        // Get access token
        const accessToken = await this.authManager.getAccessToken();

        // Prepare request headers
        const requestHeaders: Record<string, string> = {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          ...headers,
        };

        // Add Content-Type for requests with body
        if (body !== undefined) {
          requestHeaders['Content-Type'] = 'application/json';
        }

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          // Make the request
          const response = await fetch(url, {
            method,
            headers: requestHeaders,
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // Handle 401 - token expired, try to refresh
          if (response.status === 401 && attempt < this.MAX_RETRIES - 1) {
            console.error('Token expired, clearing cache and retrying...');
            this.authManager.clearCache();
            continue; // Retry with new token
          }

          // Handle non-OK responses
          if (!response.ok) {
            const error = await UnoPimApiError.fromResponse(response);

            // Retry if error is retryable and we have attempts left
            if (error.retryPossible && attempt < this.MAX_RETRIES - 1) {
              console.error(`Request failed (attempt ${attempt + 1}): ${error.message}, retrying...`);
              continue;
            }

            throw error;
          }

          // Handle 204 No Content
          if (response.status === 204) {
            return {} as T;
          }

          // Parse and return response
          const data = await response.json() as T;
          return data;

        } catch (error) {
          clearTimeout(timeoutId);

          // Handle abort (timeout)
          if (error instanceof Error && error.name === 'AbortError') {
            throw new UnoPimApiError(
              'NETWORK_ERROR',
              `Request timeout after ${timeout}ms`,
              error,
              true
            );
          }

          throw error;
        }

      } catch (error) {
        // If it's already a UnoPimApiError, check if we should retry
        if (error instanceof UnoPimApiError) {
          if (error.retryPossible && attempt < this.MAX_RETRIES - 1) {
            console.error(`Request failed (attempt ${attempt + 1}): ${error.message}, retrying...`);
            continue;
          }
          throw error;
        }

        // Network or other errors
        if (attempt < this.MAX_RETRIES - 1) {
          console.error(`Network error (attempt ${attempt + 1}):`, error);
          continue;
        }

        throw UnoPimApiError.networkError(error);
      }
    }

    // Should never reach here, but TypeScript needs it
    throw new UnoPimApiError(
      'SERVER_ERROR',
      'Max retries exceeded',
      undefined,
      false
    );
  }

  /**
   * Helper to build query string from parameters
   */
  buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
    const filtered = Object.entries(params)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);

    return filtered.length > 0 ? `?${filtered.join('&')}` : '';
  }

  /**
   * Helper to build URL with query parameters
   */
  buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
    if (!params) {
      return endpoint;
    }
    const queryString = this.buildQueryString(params);
    return `${endpoint}${queryString}`;
  }

  /**
   * Sleep helper for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get the base URL (useful for debugging)
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Makes a POST request with multipart/form-data (for file uploads)
   */
  async postMultipart<T>(endpoint: string, formData: FormData): Promise<T> {
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    // Use /api/v1/rest base path for API calls
    const url = `${this.baseUrl}/api/v1/rest${normalizedEndpoint}`;

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          await this.sleep(this.RETRY_DELAYS[attempt]);
        }

        const accessToken = await this.authManager.getAccessToken();

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            // Note: Don't set Content-Type for multipart - fetch will set it with boundary
          },
          body: formData,
        });

        if (response.status === 401 && attempt < this.MAX_RETRIES - 1) {
          this.authManager.clearCache();
          continue;
        }

        const data = await response.json() as T;
        return data;

      } catch (error) {
        if (attempt < this.MAX_RETRIES - 1) {
          console.error(`Multipart request failed (attempt ${attempt + 1}):`, error);
          continue;
        }
        throw error;
      }
    }

    throw new Error('Max retries exceeded for multipart upload');
  }
}
