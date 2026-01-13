/**
 * Error types and codes for UnoPim MCP Server
 */

export type ErrorCode =
  | 'AUTH_FAILED'
  | 'TOKEN_EXPIRED'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'DUPLICATE_CODE'
  | 'DEPENDENCY_MISSING'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR';

export interface UnoPimError {
  code: ErrorCode;
  message: string;
  details?: unknown;
  retry_possible: boolean;
}

export class UnoPimApiError extends Error {
  public code: ErrorCode;
  public details?: unknown;
  public retryPossible: boolean;
  public statusCode?: number;

  constructor(
    code: ErrorCode,
    message: string,
    details?: unknown,
    retryPossible: boolean = false,
    statusCode?: number
  ) {
    super(message);
    this.name = 'UnoPimApiError';
    this.code = code;
    this.details = details;
    this.retryPossible = retryPossible;
    this.statusCode = statusCode;
  }

  toJSON(): UnoPimError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      retry_possible: this.retryPossible,
    };
  }

  /**
   * Creates an error from an HTTP response
   */
  static async fromResponse(response: Response): Promise<UnoPimApiError> {
    let details: unknown;
    try {
      details = await response.json();
    } catch {
      details = await response.text();
    }

    const statusCode = response.status;

    // Map HTTP status codes to error codes
    switch (statusCode) {
      case 401:
        return new UnoPimApiError(
          'AUTH_FAILED',
          'Authentication failed',
          details,
          true,
          statusCode
        );
      case 404:
        return new UnoPimApiError(
          'NOT_FOUND',
          'Resource not found',
          details,
          false,
          statusCode
        );
      case 409:
        return new UnoPimApiError(
          'DUPLICATE_CODE',
          'Resource with this code already exists',
          details,
          false,
          statusCode
        );
      case 422:
        return new UnoPimApiError(
          'VALIDATION_ERROR',
          'Validation failed',
          details,
          false,
          statusCode
        );
      case 429:
        return new UnoPimApiError(
          'RATE_LIMITED',
          'Rate limit exceeded',
          details,
          true,
          statusCode
        );
      case 500:
      case 502:
      case 503:
      case 504:
        return new UnoPimApiError(
          'SERVER_ERROR',
          `Server error: ${statusCode}`,
          details,
          true,
          statusCode
        );
      default:
        return new UnoPimApiError(
          'SERVER_ERROR',
          `HTTP error: ${statusCode} ${response.statusText}`,
          details,
          statusCode >= 500,
          statusCode
        );
    }
  }

  /**
   * Creates a network error
   */
  static networkError(originalError: unknown): UnoPimApiError {
    return new UnoPimApiError(
      'NETWORK_ERROR',
      `Network error: ${originalError}`,
      originalError,
      true
    );
  }
}
