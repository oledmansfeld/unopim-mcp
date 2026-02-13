/**
 * Standalone test script to verify UnoPim API connectivity
 */

// Configuration from environment
const config = {
  baseUrl: process.env.UNOPIM_BASE_URL || 'https://your-instance.pim.dk',
  clientId: process.env.UNOPIM_CLIENT_ID || 'your-client-id',
  clientSecret: process.env.UNOPIM_CLIENT_SECRET || 'your-client-secret',
  username: process.env.UNOPIM_USERNAME || 'your-username@example.com',
  password: process.env.UNOPIM_PASSWORD || 'your-password',
};

console.log('═══════════════════════════════════════════════════════');
console.log('  UnoPim API Connection Test');
console.log('═══════════════════════════════════════════════════════\n');

console.log('Configuration:');
console.log(`  Base URL: ${config.baseUrl}`);
console.log(`  Client ID: ${config.clientId.substring(0, 20)}...`);
console.log(`  Username: ${config.username}\n`);

async function testConnection() {
  try {
    // Step 1: Get OAuth token
    console.log('1. Requesting OAuth token...');

    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

    const tokenResponse = await fetch(`${config.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: config.username,
        password: config.password,
        grant_type: 'password'
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token request failed: ${tokenResponse.status} ${tokenResponse.statusText}\n${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log(`   ✓ Token acquired successfully`);
    console.log(`   Token: ${tokenData.access_token.substring(0, 30)}...`);
    console.log(`   Expires in: ${tokenData.expires_in} seconds\n`);

    // Step 2: Test API - Get locales
    console.log('2. Testing API: GET /api/v1/rest/locales...');

    const localesResponse = await fetch(`${config.baseUrl}/api/v1/rest/locales`, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json',
      }
    });

    if (!localesResponse.ok) {
      const errorText = await localesResponse.text();
      throw new Error(`Locales request failed: ${localesResponse.status} ${localesResponse.statusText}\n${errorText}`);
    }

    const localesData = await localesResponse.json();
    console.log(`   ✓ Retrieved ${localesData.data?.length || 0} locales`);

    if (localesData.data && localesData.data.length > 0) {
      console.log('   Available locales:');
      localesData.data.forEach(locale => {
        console.log(`     - ${locale.code}: ${locale.name}`);
      });
    }
    console.log();

    // Step 3: Test API - Get channels
    console.log('3. Testing API: GET /api/v1/rest/channels...');

    const channelsResponse = await fetch(`${config.baseUrl}/api/v1/rest/channels`, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json',
      }
    });

    if (!channelsResponse.ok) {
      const errorText = await channelsResponse.text();
      throw new Error(`Channels request failed: ${channelsResponse.status} ${channelsResponse.statusText}\n${errorText}`);
    }

    const channelsData = await channelsResponse.json();
    console.log(`   ✓ Retrieved ${channelsData.data?.length || 0} channels`);

    if (channelsData.data && channelsData.data.length > 0) {
      console.log('   Available channels:');
      channelsData.data.forEach(channel => {
        console.log(`     - ${channel.code}: ${channel.name}`);
        if (channel.locales) {
          console.log(`       Locales: ${channel.locales.join(', ')}`);
        }
        if (channel.currencies) {
          console.log(`       Currencies: ${channel.currencies.join(', ')}`);
        }
      });
    }
    console.log();

    // Step 4: Test API - Get attributes
    console.log('4. Testing API: GET /api/v1/rest/attributes...');

    const attributesResponse = await fetch(`${config.baseUrl}/api/v1/rest/attributes?limit=5`, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json',
      }
    });

    if (!attributesResponse.ok) {
      const errorText = await attributesResponse.text();
      throw new Error(`Attributes request failed: ${attributesResponse.status} ${attributesResponse.statusText}\n${errorText}`);
    }

    const attributesData = await attributesResponse.json();
    console.log(`   ✓ Retrieved ${attributesData.data?.length || 0} attributes (showing first 5)`);

    if (attributesData.data && attributesData.data.length > 0) {
      console.log('   Sample attributes:');
      attributesData.data.forEach(attr => {
        const label = attr.labels?.en_US || attr.labels?.da_DK || Object.values(attr.labels || {})[0] || 'No label';
        console.log(`     - ${attr.code} (${attr.type}): ${label}`);
      });
    }
    console.log();

    console.log('═══════════════════════════════════════════════════════');
    console.log('  ✅ ALL TESTS PASSED!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\nYour UnoPim MCP Server is ready to use!\n');
    console.log('Next steps:');
    console.log('  1. Configure Claude Desktop with these credentials');
    console.log('  2. Restart Claude Desktop');
    console.log('  3. Try: "Show me the UnoPim schema"\n');

  } catch (error) {
    console.error('\n═══════════════════════════════════════════════════════');
    console.error('  ❌ TEST FAILED');
    console.error('═══════════════════════════════════════════════════════');
    console.error('\nError:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  - Verify the base URL is correct and accessible');
    console.error('  - Check that credentials are valid');
    console.error('  - Ensure UnoPim instance is running');
    console.error('  - Check firewall/network settings\n');
    process.exit(1);
  }
}

testConnection();
