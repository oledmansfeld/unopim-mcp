/**
 * Test script for image upload functionality
 * Tests the fixed uploadProductMedia function
 */

import { UnoPimClient } from './src/client/unopim-client.js';
import { OAuthManager } from './src/auth/oauth.js';
import { uploadProductMedia } from './src/tools/products.js';
import { loadConfig } from './src/config.js';

async function testImageUpload() {
  try {
    console.log('🔧 Loading configuration...');
    const config = loadConfig();

    console.log('🔌 Connecting to UnoPim:', config.baseUrl);

    // Create OAuth manager
    const authManager = new OAuthManager(config.baseUrl, {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      username: config.username,
      password: config.password,
    });

    // Create UnoPim client
    const client = new UnoPimClient(config.baseUrl, authManager);

    // Initialize (gets OAuth token)
    await authManager.getAccessToken();
    console.log('✅ Connected successfully\n');

    // Test 1: Find the "piano black EQ8" product
    console.log('🔍 Searching for "piano black EQ8" product...');
    const products = await client.get<{ data: any[] }>('/api/v1/rest/products');

    console.log(`Found ${products.data.length} products total. Showing first 10:\n`);
    products.data.slice(0, 10).forEach((p: any) => {
      const name =
        p.values?.channel_locale_specific?.default?.da_DK?.name ||
        p.values?.channel_locale_specific?.default?.en_US?.name ||
        p.values?.locale_specific?.da_DK?.name ||
        p.values?.locale_specific?.en_US?.name ||
        p.values?.common?.name ||
        'N/A';
      console.log(`  SKU: ${p.sku}`);
      console.log(`  Name: ${name}`);
      console.log(`  Family: ${p.family || 'N/A'}`);
      console.log('');
    });

    let targetProduct = products.data.find((p: any) => {
      const name = (
        p.values?.channel_locale_specific?.default?.da_DK?.name ||
        p.values?.channel_locale_specific?.default?.en_US?.name ||
        p.values?.locale_specific?.da_DK?.name ||
        p.values?.locale_specific?.en_US?.name ||
        p.values?.common?.name ||
        ''
      ).toLowerCase();
      return name.includes('piano') || name.includes('eq8') || p.sku?.toLowerCase().includes('eq8');
    });

    if (!targetProduct) {
      console.log('❌ Product "piano black EQ8" not found automatically.');
      console.log('💡 Please specify the SKU manually.');
      return;
    }

    console.log(`✅ Found product: ${targetProduct.sku}`);
    console.log(`   Name: ${targetProduct.values?.channel_locale_specific?.default?.da_DK?.name || 'N/A'}\n`);

    // Test 2: Check if product has an image attribute
    console.log('🔍 Checking product family for image attribute...');
    const familyResponse = await client.get<any>(`/api/v1/rest/families/${targetProduct.family}`);
    const family = familyResponse.data || familyResponse;

    const imageAttr = family.attributes?.find((attr: any) =>
      attr.type === 'image' || attr.code === 'image' || attr.code === 'images'
    );

    if (!imageAttr) {
      console.log('❌ No image attribute found in family. Available attributes:');
      family.attributes?.forEach((attr: any) => {
        console.log(`  - ${attr.code} (${attr.type})`);
      });
      console.log('\n💡 Defaulting to "image" attribute...');
      // Default to "image" attribute even if not found in family
      // Try with "image" anyway
    }

    const attributeCode = imageAttr?.code || 'image';
    console.log(`✅ Using image attribute: ${attributeCode}\n`);

    // Test 3: Upload the image
    console.log('📸 Uploading image...');
    console.log('   URL: https://justmore.dk/images/media/Products/thumbs/800_800/Siemens-EQ6-plus-s100-TE651319RW-espressomaskine-sort.jpg');

    const result = await uploadProductMedia(client, {
      sku: targetProduct.sku,
      attribute: attributeCode,
      file_url: 'https://justmore.dk/images/media/Products/thumbs/800_800/Siemens-EQ6-plus-s100-TE651319RW-espressomaskine-sort.jpg',
      filename: 'siemens-eq8-piano-black.jpg'
    });

    if (result.success) {
      console.log('✅ Image uploaded successfully!');
      console.log(`   File path: ${result.filePath}`);
      console.log(`   Message: ${result.message}\n`);

      // Test 4: Verify the image is linked to the product
      console.log('🔍 Verifying product was updated...');
      const updatedProductResponse = await client.get<any>(`/api/v1/rest/products/${encodeURIComponent(targetProduct.sku)}`);
      const updatedProduct = updatedProductResponse.data || updatedProductResponse;

      // Check all possible scopes for the image
      const imageValue =
        updatedProduct.values?.common?.[attributeCode] ||
        updatedProduct.values?.locale_specific?.da_DK?.[attributeCode] ||
        updatedProduct.values?.channel_specific?.default?.[attributeCode] ||
        updatedProduct.values?.channel_locale_specific?.default?.da_DK?.[attributeCode];

      if (imageValue) {
        console.log('✅ Image is linked to product!');
        console.log(`   Attribute: ${attributeCode}`);
        console.log(`   Value: ${imageValue}`);
        console.log('\n🎉 TEST PASSED! Image should now be visible in UnoPim UI.');
        console.log(`   View product: ${config.baseUrl}/admin/catalog/products/${encodeURIComponent(targetProduct.sku)}`);
      } else {
        console.log('⚠️  Image uploaded but not found in product values');
        console.log('   Product values:', JSON.stringify(updatedProduct.values, null, 2));
      }
    } else {
      console.log('❌ Image upload failed!');
      console.log(`   Error: ${result.error}`);
      console.log(`   Message: ${result.message}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testImageUpload();
