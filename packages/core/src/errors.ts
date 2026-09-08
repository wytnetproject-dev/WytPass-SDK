/**
 * Sanitized and strongly typed error classes for WytPass SDK.
 * All errors ensure sensitive credentials, tokens, verifiers, and codes
 * are never leaked into error messages or stack traces.
 */

export class WytPassError extends Error {
  public override readonly name: string = 'WytPassError';
  public readonly code: string;

  constructor(message: string, code: string = 'WYTPASS_ERROR') {
    super(sanitizeErrorMessage(message));
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConfigurationError extends WytPassError {
  public override readonly name: string = 'ConfigurationError';

  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR');
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

export class InvalidStateError extends WytPassError {
  public override readonly name: string = 'InvalidStateError';

  constructor(message: string = 'OAuth state parameter mismatch or missing. Possible CSRF attack detected.') {
    super(message, 'INVALID_STATE');
    Object.setPrototypeOf(this, InvalidStateError.prototype);
  }
}

export class OAuthError extends WytPassError {
  public override readonly name: string = 'OAuthError';
  public readonly error: string;
  public readonly errorDescription?: string;
  public readonly errorUri?: string;
  public readonly statusCode?: number;

  constructor(error: string, errorDescription?: string, errorUri?: string, statusCode?: number) {
    const desc = errorDescription ? `: ${sanitizeErrorMessage(errorDescription)}` : '';
    super(`OAuth error [${error}]${desc}`, error);
    this.error = error;
    this.errorDescription = errorDescription ? sanitizeErrorMessage(errorDescription) : undefined;
    this.errorUri = errorUri;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, OAuthError.prototype);
  }
}

export class TokenExchangeError extends WytPassError {
  public override readonly name: string = 'TokenExchangeError';
  public readonly statusCode?: number;
  public readonly responseBody?: unknown;

  constructor(message: string, statusCode?: number, responseBody?: unknown) {
    super(message, 'TOKEN_EXCHANGE_ERROR');
    this.statusCode = statusCode;
    this.responseBody = sanitizeData(responseBody);
    Object.setPrototypeOf(this, TokenExchangeError.prototype);
  }
}

export class UserInfoError extends WytPassError {
  public override readonly name: string = 'UserInfoError';
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message, 'USERINFO_ERROR');
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, UserInfoError.prototype);
  }
}

export class NetworkError extends WytPassError {
  public override readonly name: string = 'NetworkError';
  public readonly originalError?: Error;

  constructor(message: string, originalError?: Error) {
    super(message, 'NETWORK_ERROR');
    this.originalError = originalError;
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

export class DiscoveryError extends WytPassError {
  public override readonly name: string = 'DiscoveryError';

  constructor(message: string) {
    super(message, 'DISCOVERY_ERROR');
    Object.setPrototypeOf(this, DiscoveryError.prototype);
  }
}

export class TokenValidationError extends WytPassError {
  public override readonly name: string = 'TokenValidationError';

  constructor(message: string) {
    super(message, 'TOKEN_VALIDATION_ERROR');
    Object.setPrototypeOf(this, TokenValidationError.prototype);
  }
}

/**
 * Strips sensitive values like secret keys, auth codes, and bearer tokens from error strings.
 */
function sanitizeErrorMessage(message: string): string {
  if (!message || typeof message !== 'string') return '';
  return message
    .replace(/(client_secret|clientSecret)=([^&\s]+)/gi, '$1=[REDACTED]')
    .replace(/(code_verifier|codeVerifier)=([^&\s]+)/gi, '$1=[REDACTED]')
    .replace(/(code)=([^&\s]+)/gi, '$1=[REDACTED]')
    .replace(/(access_token|accessToken)=([^&\s]+)/gi, '$1=[REDACTED]')
    .replace(/(refresh_token|refreshToken)=([^&\s]+)/gi, '$1=[REDACTED]')
    .replace(/(Bearer\s+)[A-Za-z0-9-_.]+/gi, '$1[REDACTED]');
}

/**
 * Deeply scrubs sensitive fields from error objects or payload dumps.
 */
function sanitizeData(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }
  const sanitized: Record<string, unknown> = {};
  const sensitiveKeys = new Set([
    'client_secret',
    'clientSecret',
    'access_token',
    'accessToken',
    'refresh_token',
    'refreshToken',
    'code_verifier',
    'codeVerifier',
    'code',
    'password'
  ]);

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (sensitiveKeys.has(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
