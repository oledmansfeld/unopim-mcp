/**
 * Test script for UnoPim HTTP client
 * Demonstrates client usage and verifies API connectivity
 */

import { loadConfig } from './src/config.js';
import { OAuthManager } from './src/auth/oauth.js';
import { UnoPimClient } from './src/client/unopim-client.js';
import type { ListResponse, Locale, Channel } from './src/types/unopim.js';

async function testClient() {
  try {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  UnoPim HTTP Client Test');
    console.log('═══════════════════════════════════════════════════════\n');

    // Load configuration
    console.log('1. Loading configuration...');
    const config = loadConfig();
    console.log(`   ✓ Base URL: ${config.baseUrl}`);
    console.log(`   ✓ Default Locale: ${config.defaultLocale}`);
    console.log(`   ✓ Default Currency: ${config.defaultCurrency}\n`);

    // Initialize OAuth manager
    console.log('2. Initializing OAuth manager...');
    const authManager = new OAuthManager(config.baseUrl, {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      username: config.username,
      password: config.password,
    });
    console.log('   ✓ OAuth manager ready\n');

    // Initialize UnoPim client
    console.log('3. Initializing UnoPim client...');
    const client = new UnoPimClient(config.baseUrl, authManager);
    console.log('   ✓ Client ready\n');

    // Test API connectivity - Get locales
    console.log('4. Testing API connectivity (GET /api/v1/rest/locales)...');
    try {
      const localesResponse = await client.get<ListResponse<Locale>>('/api/v1/rest/locales');
      console.log(`   ✓ Successfully retrieved ${localesResponse.data?.length || 0} locales`);

      if (localesResponse.data && localesResponse.data.length > 0) {
        console.log('   Available locales:');
        localesResponse.data.forEach(locale => {
          console.log(`     - ${locale.code}: ${locale.name}`);
        });
      }
      console.log();
    } catch (error) {
      console.error('   ✗ Failed to retrieve locales:', error);
      throw error;
    }

    // Test channels endpoint
    console.log('5. Testing channels endpoint (GET /api/v1/rest/channels)...');
    try {
      const channelsResponse = await client.get<ListResponse<Channel>>('/api/v1/rest/channels');
      console.log(`   ✓ Successfully retrieved ${channelsResponse.data?.length || 0} channels`);

      if (channelsResponse.data && channelsResponse.data.length > 0) {
        console.log('   Available channels:');
        channelsResponse.data.forEach(channel => {
          console.log(`     - ${channel.code}: ${channel.name}`);
          console.log(`       Locales: ${channel.locales.join(', ')}`);
          console.log(`       Currencies: ${channel.currencies.join(', ')}`);
        });
      }
      console.log();
    } catch (error) {
      console.error('   ✗ Failed to retrieve channels:', error);
      throw error;
    }

    // Test query string builder
    console.log('6. Testing query string builder...');
    const testUrl = client.buildUrl('/api/v1/rest/attributes', {
      page: 1,
      limit: 10,
      type: 'select',
    });
    console.log(`   ✓ Built URL: ${testUrl}\n`);

    console.log('═══════════════════════════════════════════════════════');
    console.log('  ✓ All tests passed successfully!');
    console.log('═══════════════════════════════════════════════════════');

  } catch (error) {
    console.error('\n═══════════════════════════════════════════════════════');
    console.error('  ✗ Test failed');
    console.error('═══════════════════════════════════════════════════════');
    console.error(error);
    process.exit(1);
  }
}

testClient();
