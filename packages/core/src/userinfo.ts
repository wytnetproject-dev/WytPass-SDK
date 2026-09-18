import { DEFAULT_REQUEST_TIMEOUT_MS, DEFAULT_USERINFO_ENDPOINT, ENVIRONMENTS } from './constants.js';
import { NetworkError, OAuthError, UserInfoError } from './errors.js';
import type { WytPassConfig, WytPassUser } from './types.js';
import { validateEndpointUrl } from './authorization.js';

/**
 * Resolves the userinfo endpoint URL considering config overrides, apiUrl, and environment presets.
 */
function resolveUserInfoEndpoint(config: WytPassConfig): URL {
  const envConfig = config.environment ? ENVIRONMENTS[config.environment] : undefined;
  const allowHttp = config.allowHttp ?? envConfig?.allowHttp ?? false;

  const baseEndpoint =
    config.userInfoEndpoint ||
    (config.apiUrl ? `${config.apiUrl.replace(/\/+$/, '')}/oauth/userinfo` : undefined) ||
    envConfig?.userInfoEndpoint ||
    DEFAULT_USERINFO_ENDPOINT;

  return validateEndpointUrl(baseEndpoint, 'userInfoEndpoint', allowHttp);
}

/**
 * Normalizes raw WytPass userinfo payloads from various provider response formats.
 */
export function normalizeUserInfo(rawResponse: Record<string, unknown>): WytPassUser {
  // Support responses nested under 'user' or 'data' or top-level
  let payload = rawResponse;
  if (rawResponse['user'] && typeof rawResponse['user'] === 'object' && !Array.isArray(rawResponse['user'])) {
    payload = { ...rawResponse, ...(rawResponse['user'] as Record<string, unknown>) };
  } else if (rawResponse['data'] && typeof rawResponse['data'] === 'object' && !Array.isArray(rawResponse['data'])) {
    payload = { ...rawResponse, ...(rawResponse['data'] as Record<string, unknown>) };
  }

  const id = String(
    payload['id'] ?? payload['sub'] ?? payload['user_id'] ?? payload['_id'] ?? ''
  );

  const sub = String(
    payload['sub'] ?? payload['id'] ?? payload['user_id'] ?? ''
  );

  const name = typeof payload['name'] === 'string'
    ? payload['name']
    : typeof payload['username'] === 'string'
      ? payload['username']
      : typeof payload['full_name'] === 'string'
        ? payload['full_name']
        : undefined;

  const email = typeof payload['email'] === 'string' ? payload['email'] : undefined;

  const picture = typeof payload['picture'] === 'string'
    ? payload['picture']
    : typeof payload['profilePicture'] === 'string'
      ? payload['profilePicture']
      : typeof payload['avatar'] === 'string'
        ? payload['avatar']
        : undefined;

  const profilePicture = typeof payload['profilePicture'] === 'string'
    ? payload['profilePicture']
    : picture;

  const subscriptions = payload['subscriptions'] ?? payload['subscription'] ?? [];

  return {
    id: id || sub,
    sub: sub || id,
    name,
    email,
    picture,
    profilePicture,
    subscriptions,
    raw: rawResponse,
    ...payload
  };
}

/**
 * Fetches user profile information using an active OAuth access token.
 */
export async function fetchUserInfo(
  config: WytPassConfig,
  accessToken: string
): Promise<WytPassUser> {
  if (!accessToken || typeof accessToken !== 'string') {
    throw new UserInfoError('Access token is required to fetch userinfo.');
  }

  const userInfoUrl = resolveUserInfoEndpoint(config);

  const fetchFn = config.fetch || globalThis.fetch;
  if (typeof fetchFn !== 'function') {
    throw new NetworkError('No fetch function available.');
  }

  const timeoutMs = config.timeoutMs || DEFAULT_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(userInfoUrl.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      let errorDetail: string | undefined;
      try {
        const errJson = await response.json();
        if (errJson && typeof errJson === 'object') {
          errorDetail = errJson.detail || errJson.message || errJson.error_description;
        }
      } catch {
        // Non-JSON response
      }

      if (response.status === 401) {
        throw new OAuthError(
          'invalid_token',
          errorDetail || 'Access token is invalid or expired.',
          undefined,
          response.status
        );
      }
      throw new UserInfoError(
        `Failed to fetch userinfo from ${userInfoUrl.toString()} (HTTP ${response.status})${errorDetail ? `: ${errorDetail}` : ''}.`,
        response.status
      );
    }

    const data = await response.json();
    if (!data || typeof data !== 'object') {
      throw new UserInfoError('Invalid userinfo response format: expected JSON object.');
    }

    return normalizeUserInfo(data as Record<string, unknown>);
  } catch (err: unknown) {
    if (err instanceof UserInfoError || err instanceof OAuthError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new NetworkError(`UserInfo request timed out after ${timeoutMs}ms.`);
    }
    throw new NetworkError(
      `Network failure while fetching userinfo: ${err instanceof Error ? err.message : String(err)}`,
      err instanceof Error ? err : undefined
    );
  } finally {
    clearTimeout(timer);
  }
}
