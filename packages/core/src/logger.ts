import type { WytPassLogger } from './types.js';

/**
 * Strips sensitive data from logged parameters.
 */
function sanitizeLogItem(item: unknown): unknown {
  if (typeof item === 'string') {
    return item
      .replace(/(client_secret|clientSecret)=([^&\s]+)/gi, '$1=[REDACTED]')
      .replace(/(code_verifier|codeVerifier)=([^&\s]+)/gi, '$1=[REDACTED]')
      .replace(/(code)=([^&\s]+)/gi, '$1=[REDACTED]')
      .replace(/(access_token|accessToken)=([^&\s]+)/gi, '$1=[REDACTED]')
      .replace(/(refresh_token|refreshToken)=([^&\s]+)/gi, '$1=[REDACTED]')
      .replace(/(Bearer\s+)[A-Za-z0-9-_.]+/gi, '$1[REDACTED]');
  }

  if (item && typeof item === 'object') {
    if (Array.isArray(item)) {
      return item.map(sanitizeLogItem);
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

    for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
      if (sensitiveKeys.has(k)) {
        sanitized[k] = '[REDACTED]';
      } else {
        sanitized[k] = sanitizeLogItem(v);
      }
    }
    return sanitized;
  }

  return item;
}

/**
 * No-op logger used by default.
 */
export class NullLogger implements WytPassLogger {
  public debug(): void {}
  public info(): void {}
  public warn(): void {}
  public error(): void {}
}

/**
 * Safe console logger that ensures tokens, codes, and secrets are never logged.
 */
export class ConsoleLogger implements WytPassLogger {
  private prefix: string;

  constructor(prefix = '[WytPass SDK]') {
    this.prefix = prefix;
  }

  public debug(message: string, ...args: unknown[]): void {
    console.debug(`${this.prefix} [DEBUG] ${message}`, ...args.map(sanitizeLogItem));
  }

  public info(message: string, ...args: unknown[]): void {
    console.info(`${this.prefix} [INFO] ${message}`, ...args.map(sanitizeLogItem));
  }

  public warn(message: string, ...args: unknown[]): void {
    console.warn(`${this.prefix} [WARN] ${message}`, ...args.map(sanitizeLogItem));
  }

  public error(message: string, ...args: unknown[]): void {
    console.error(`${this.prefix} [ERROR] ${message}`, ...args.map(sanitizeLogItem));
  }
}
