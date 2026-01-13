/**
 * Simple test script to verify config and auth modules
 * Usage: Set environment variables and run with ts-node or compile first
 */

import { loadConfig } from './src/config.js';
import { OAuthManager } from './src/auth/oauth.js';

async function testAuth() {
  try {
    console.log('Loading configuration...');
    const config = loadConfig();

    console.log(`✓ Configuration loaded successfully`);
    console.log(`  Base URL: ${config.baseUrl}`);
    console.log(`  Default Locale: ${config.defaultLocale}`);
    console.log(`  Default Currency: ${config.defaultCurrency}`);

    console.log('\nInitializing OAuth manager...');
    const authManager = new OAuthManager(config.baseUrl, {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      username: config.username,
      password: config.password,
    });

    console.log('Acquiring access token...');
    const token = await authManager.getAccessToken();

    console.log(`✓ Access token acquired successfully`);
    console.log(`  Token: ${token.substring(0, 20)}...`);

    console.log('\nTesting token cache...');
    const token2 = await authManager.getAccessToken();

    if (token === token2) {
      console.log('✓ Token cache working correctly');
    } else {
      console.log('✗ Token cache not working - got different tokens');
    }

  } catch (error) {
    console.error('✗ Test failed:', error);
    process.exit(1);
  }
}

testAuth();
