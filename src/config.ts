/**
 * Configuration management for UnoPim MCP Server
 * Reads and validates environment variables
 */

export interface UnoPimConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  defaultLocale: string;
  defaultChannel: string;
  defaultCurrency: string;
}

/**
 * Loads and validates configuration from environment variables
 * @throws Error if required environment variables are missing
 */
export function loadConfig(): UnoPimConfig {
  const requiredVars = [
    'UNOPIM_BASE_URL',
    'UNOPIM_CLIENT_ID',
    'UNOPIM_CLIENT_SECRET',
    'UNOPIM_USERNAME',
    'UNOPIM_PASSWORD',
  ] as const;

  // Validate required variables
  const missing: string[] = [];
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please configure them in your claude_desktop_config.json'
    );
  }

  // Normalize base URL (remove trailing slash)
  let baseUrl = process.env.UNOPIM_BASE_URL!;
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }

  return {
    baseUrl,
    clientId: process.env.UNOPIM_CLIENT_ID!,
    clientSecret: process.env.UNOPIM_CLIENT_SECRET!,
    username: process.env.UNOPIM_USERNAME!,
    password: process.env.UNOPIM_PASSWORD!,
    defaultLocale: process.env.UNOPIM_DEFAULT_LOCALE || 'en_US',
    defaultChannel: process.env.UNOPIM_DEFAULT_CHANNEL || 'default',
    defaultCurrency: process.env.UNOPIM_DEFAULT_CURRENCY || 'USD',
  };
}

/**
 * Validates that a URL is properly formed
 */
export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
