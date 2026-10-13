const PUSH_KEY = /^[A-Za-z0-9_-]+$/;

export function isValidPushEndpoint(endpoint: string): boolean {
  if (endpoint.length < 20 || endpoint.length > 2000 || endpoint.includes(" ")) {
    return false;
  }
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidPushKey(value: string): boolean {
  return value.length >= 16 && value.length <= 200 && PUSH_KEY.test(value);
}

export function isPushDrainAuthorized(
  authorizationHeader: string | null,
  env: { PUSH_DELIVERY_SECRET?: string; CRON_SECRET?: string },
): boolean {
  const secret = env.PUSH_DELIVERY_SECRET?.trim() || env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }
  return authorizationHeader === `Bearer ${secret}`;
}
