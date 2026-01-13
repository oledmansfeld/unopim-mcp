/**
 * Product management tools for UnoPim
 * Handles product creation (simple, configurable, and bulk)
 */

import { z } from 'zod';
import type { UnoPimClient } from '../client/unopim-client.js';
import type { Product, ConfigurableProduct, ProductVariant, ProductValues, BulkCreateResult } from '../types/unopim.js';

// ============================================================================
// Types for smart product creation
// ============================================================================

interface AttributeMetadata {
  code: string;
  type: string;
  is_required: boolean;
  value_per_locale: boolean;
  value_per_channel: boolean;
  validation?: string | null;
}

interface FamilyAttributeInfo {
  familyCode: string;
  attributes: AttributeMetadata[];
  requiredAttributes: AttributeMetadata[];
  commonAttributes: AttributeMetadata[];           // value_per_locale=0, value_per_channel=0
  localeAttributes: AttributeMetadata[];           // value_per_locale=1, value_per_channel=0
  channelAttributes: AttributeMetadata[];          // value_per_locale=0, value_per_channel=1
  channelLocaleAttributes: AttributeMetadata[];    // value_per_locale=1, value_per_channel=1
}

interface ValidationResult {
  valid: boolean;
  errors: Array<{ field: string; message: string }>;
  warnings: Array<{ field: string; message: string }>;
}

// ============================================================================
// Input Schemas
// ============================================================================

const ProductValuesSchema = z.object({
  common: z.record(z.string(), z.unknown()).optional(),
  categories: z.array(z.string()).optional(),
  locale_specific: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  channel_specific: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  channel_locale_specific: z.record(z.string(), z.record(z.string(), z.record(z.string(), z.unknown()))).optional(),
  associations: z.object({
    up_sells: z.array(z.string()).optional(),
    cross_sells: z.array(z.string()).optional(),
    related_products: z.array(z.string()).optional(),
  }).optional(),
});

export const CreateProductInputSchema = z.object({
  sku: z.string(),
  family: z.string(),
  values: ProductValuesSchema,
});

const ProductVariantSchema = z.object({
  sku: z.string(),
  attributes: z.record(z.string(), z.string()),
  values: ProductValuesSchema.optional(),
});

export const CreateConfigurableProductInputSchema = z.object({
  sku: z.string(),
  family: z.string(),
  super_attributes: z.array(z.string()).min(1, 'At least one super attribute is required'),
  values: ProductValuesSchema,
  variants: z.array(ProductVariantSchema).optional(),
});

export const BulkCreateProductsInputSchema = z.object({
  products: z.array(CreateProductInputSchema),
  on_error: z.enum(['stop', 'continue']).default('continue'),
  validate_only: z.boolean().optional().default(false),
});

export const GetProductsInputSchema = z.object({
  filter_sku: z.string().optional(),
  filter_family: z.string().optional(),
  filter_type: z.enum(['simple', 'configurable']).optional(),
  limit: z.number().optional().default(100),
  page: z.number().optional().default(1),
});

export const GetProductInputSchema = z.object({
  sku: z.string(),
});

export const UpdateProductInputSchema = z.object({
  sku: z.string(),
  values: ProductValuesSchema,
});

export const UpsertProductInputSchema = z.object({
  sku: z.string(),
  family: z.string(),
  values: ProductValuesSchema,
});

export type CreateProductInput = z.infer<typeof CreateProductInputSchema>;
export type CreateConfigurableProductInput = z.infer<typeof CreateConfigurableProductInputSchema>;
export type BulkCreateProductsInput = z.infer<typeof BulkCreateProductsInputSchema>;
export type GetProductsInput = z.infer<typeof GetProductsInputSchema>;
export type GetProductInput = z.infer<typeof GetProductInputSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductInputSchema>;
export type UpsertProductInput = z.infer<typeof UpsertProductInputSchema>;

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * unopim_create_product
 * Creates a simple product
 * 
 * IMPORTANT: The values object must follow this structure:
 * - categories: INSIDE values (not at top level of request)
 * - common: for attributes with value_per_locale=0 AND value_per_channel=0
 * - channel_specific: for attributes with value_per_channel=1 AND value_per_locale=0
 * - channel_locale_specific: for attributes with value_per_channel=1 AND value_per_locale=1
 * - Attribute option values are CASE-SENSITIVE (e.g., "Black" not "black")
 */
export async function createProduct(
  client: UnoPimClient,
  input: CreateProductInput
): Promise<{
  success: boolean;
  product: Product;
  errors?: Array<{ field: string; message: string }>;
}> {
  try {
    // SKU must be in values.common if not already there
    const values = { ...input.values };
    if (!values.common) {
      values.common = {};
    }
    if (typeof values.common === 'object' && values.common !== null) {
      (values.common as Record<string, unknown>)['sku'] = input.sku;
    }

    // UnoPim requires these fields for product creation
    const productData = {
      parent: null,           // Required: null for standalone products
      family: input.family,
      type: 'simple',         // Required: 'simple' or 'configurable'
      additional: null,       // Required: null for basic products
      values: values,         // Values object with categories INSIDE
    };

    const response = await client.post<{ data: Product }>(
      '/api/v1/rest/products',
      productData
    );

    return {
      success: true,
      product: response.data,
    };
  } catch (error) {
    throw new Error(`Failed to create product: ${error}`);
  }
}

/**
 * unopim_create_configurable_product
 * Creates a configurable product with variants
 */
export async function createConfigurableProduct(
  client: UnoPimClient,
  input: CreateConfigurableProductInput
): Promise<{
  success: boolean;
  product: ConfigurableProduct;
  variant_results?: Array<{
    sku: string;
    success: boolean;
    error?: string;
  }>;
}> {
  try {
    // SKU must be in values.common
    const values = { ...input.values };
    if (!values.common) {
      values.common = {};
    }
    if (typeof values.common === 'object' && values.common !== null) {
      (values.common as Record<string, unknown>)['sku'] = input.sku;
    }

    // Create the configurable product via /products endpoint
    // Note: Some UnoPim versions have /configurable-products, others use /products with type=configurable
    const configurableData = {
      parent: null,           // Required: null for parent products
      family: input.family,
      type: 'configurable',   // This tells UnoPim it's a configurable product
      additional: null,       // Required: null for basic products
      super_attributes: input.super_attributes,
      values: values,
    };

    // NOTE: UnoPim API has a typo - endpoint is "configrable" not "configurable"
    let configurableProduct: ConfigurableProduct;
    try {
      const response = await client.post<{ data: ConfigurableProduct; success?: boolean; message?: string }>(
        '/api/v1/rest/configrable-products',  // Note: typo in UnoPim API
        configurableData
      );
      configurableProduct = response.data || { sku: input.sku } as ConfigurableProduct;
    } catch (error) {
      // If configrable-products endpoint doesn't exist, try with correct spelling, then fall back to products
      const errorStr = String(error);
      if (errorStr.includes('404') || errorStr.includes('not found')) {
        try {
          const response = await client.post<{ data: ConfigurableProduct; success?: boolean; message?: string }>(
            '/api/v1/rest/configurable-products',  // Correct spelling fallback
            configurableData
          );
          configurableProduct = response.data || { sku: input.sku } as ConfigurableProduct;
        } catch (error2) {
          const errorStr2 = String(error2);
          if (errorStr2.includes('404') || errorStr2.includes('not found')) {
            const response = await client.post<{ data: ConfigurableProduct; success?: boolean; message?: string }>(
              '/api/v1/rest/products',
              configurableData
            );
            configurableProduct = response.data || { sku: input.sku } as ConfigurableProduct;
          } else {
            throw error2;
          }
        }
      } else {
        throw error;
      }
    }

    // Create variants if provided
    const variantResults: Array<{ sku: string; success: boolean; error?: string }> = [];

    if (input.variants && input.variants.length > 0) {
      for (const variant of input.variants) {
        try {
          // Create variant with parent link and variant attributes
          // Per UnoPim docs: variants are created via /products with parent
          const variantValues = { ...(variant.values || {}) };
          if (!variantValues.common) {
            variantValues.common = {};
          }
          (variantValues.common as Record<string, unknown>)['sku'] = variant.sku;

          const variantData = {
            parent: input.sku, // Link to parent configurable product
            family: input.family,
            type: 'simple',      // Variants are simple products
            additional: null,
            values: {
              common: variantValues.common,
              categories: variantValues.categories,
              locale_specific: variantValues.locale_specific,
              channel_specific: variantValues.channel_specific,
              channel_locale_specific: variantValues.channel_locale_specific,
            },
            variant: {
              attributes: variant.attributes, // e.g., { "color": "option1" }
            },
          };

          await client.post<{ data: Product }>(
            '/api/v1/rest/products',
            variantData
          );

          variantResults.push({
            sku: variant.sku,
            success: true,
          });
        } catch (error) {
          variantResults.push({
            sku: variant.sku,
            success: false,
            error: String(error),
          });
        }
      }
    }

    return {
      success: true,
      product: configurableProduct,
      variant_results: variantResults.length > 0 ? variantResults : undefined,
    };
  } catch (error) {
    throw new Error(`Failed to create configurable product: ${error}`);
  }
}

/**
 * unopim_bulk_create_products
 * Batch creation of products with error handling
 */
export async function bulkCreateProducts(
  client: UnoPimClient,
  input: BulkCreateProductsInput
): Promise<BulkCreateResult> {
  const results: Array<{ sku: string; success: boolean; error?: string }> = [];
  let createdCount = 0;
  let failedCount = 0;

  // Validation only mode
  if (input.validate_only) {
    return {
      success: true,
      created_count: 0,
      failed_count: 0,
      results: input.products.map(p => ({
        sku: p.sku,
        success: true,
      })),
    };
  }

  for (const product of input.products) {
    try {
      const productData = {
        sku: product.sku,
        family: product.family,
        type: 'simple',
        values: product.values,
      };

      await client.post<{ data: Product }>(
        '/api/v1/rest/products',
        productData
      );

      results.push({
        sku: product.sku,
        success: true,
      });
      createdCount++;
    } catch (error) {
      const errorMessage = String(error);
      results.push({
        sku: product.sku,
        success: false,
        error: errorMessage,
      });
      failedCount++;

      // Stop on error if requested
      if (input.on_error === 'stop') {
        break;
      }
    }
  }

  return {
    success: failedCount === 0,
    created_count: createdCount,
    failed_count: failedCount,
    results,
  };
}

/**
 * unopim_get_products
 * Lists products with optional filtering
 */
export async function getProducts(
  client: UnoPimClient,
  input: GetProductsInput
): Promise<{
  products: Product[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_items: number;
  };
}> {
  try {
    const params: Record<string, string | number> = {
      page: input.page || 1,
      limit: input.limit || 100,
    };

    // Add filters if provided
    if (input.filter_sku) {
      params['filter[sku]'] = input.filter_sku;
    }
    if (input.filter_family) {
      params['filter[family]'] = input.filter_family;
    }
    if (input.filter_type) {
      params['filter[type]'] = input.filter_type;
    }

    const queryString = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    const response = await client.get<{
      data: Product[];
      meta?: { current_page: number; last_page: number; total: number };
    }>(`/api/v1/rest/products?${queryString}`);

    return {
      products: response.data || [],
      pagination: {
        current_page: response.meta?.current_page || 1,
        total_pages: response.meta?.last_page || 1,
        total_items: response.meta?.total || 0,
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch products: ${error}`);
  }
}

/**
 * unopim_get_product
 * Gets a single product by SKU
 */
export async function getProduct(
  client: UnoPimClient,
  input: GetProductInput
): Promise<{
  found: boolean;
  product?: Product;
}> {
  try {
    const response = await client.get<{ data: Product }>(
      `/api/v1/rest/products/${encodeURIComponent(input.sku)}`
    );

    return {
      found: true,
      product: response.data,
    };
  } catch (error) {
    // Check if it's a 404
    if (String(error).includes('404') || String(error).includes('not found')) {
      return {
        found: false,
      };
    }
    throw new Error(`Failed to get product '${input.sku}': ${error}`);
  }
}

/**
 * unopim_update_product
 * Updates an existing product
 */
export async function updateProduct(
  client: UnoPimClient,
  input: UpdateProductInput
): Promise<{
  success: boolean;
  product: Product;
  errors?: Array<{ field: string; message: string }>;
}> {
  try {
    const response = await client.patch<{ data: Product }>(
      `/api/v1/rest/products/${encodeURIComponent(input.sku)}`,
      { values: input.values }
    );

    return {
      success: true,
      product: response.data,
    };
  } catch (error) {
    // Try to extract validation errors from API response
    const errorStr = String(error);
    const errors: Array<{ field: string; message: string }> = [];
    
    // Parse JSON error if available
    try {
      const match = errorStr.match(/\{[\s\S]*\}/);
      if (match) {
        const errorObj = JSON.parse(match[0]);
        if (errorObj.errors) {
          for (const [field, messages] of Object.entries(errorObj.errors)) {
            const msgArray = Array.isArray(messages) ? messages : [messages];
            for (const msg of msgArray) {
              errors.push({ field, message: String(msg) });
            }
          }
        }
      }
    } catch {
      // Ignore parse errors
    }

    if (errors.length > 0) {
      return {
        success: false,
        product: { sku: input.sku } as Product,
        errors,
      };
    }
    
    throw new Error(`Failed to update product '${input.sku}': ${error}`);
  }
}

/**
 * unopim_upsert_product
 * Creates or updates a product based on SKU
 */
export async function upsertProduct(
  client: UnoPimClient,
  input: UpsertProductInput
): Promise<{
  success: boolean;
  action: 'created' | 'updated';
  product: Product;
  errors?: Array<{ field: string; message: string }>;
}> {
  try {
    // First, check if product exists
    const existingResult = await getProduct(client, { sku: input.sku });

    if (existingResult.found) {
      // Update existing product
      const updateResult = await updateProduct(client, {
        sku: input.sku,
        values: input.values,
      });

      return {
        success: updateResult.success,
        action: 'updated',
        product: updateResult.product,
        errors: updateResult.errors,
      };
    } else {
      // Create new product
      const createResult = await createProduct(client, {
        sku: input.sku,
        family: input.family,
        values: input.values,
      });

      return {
        success: createResult.success,
        action: 'created',
        product: createResult.product,
        errors: createResult.errors,
      };
    }
  } catch (error) {
    throw new Error(`Failed to upsert product '${input.sku}': ${error}`);
  }
}

// ============================================================================
// Smart Product Creation - Family Schema Helpers
// ============================================================================

/**
 * Fetches all attribute metadata for a given family
 * This is crucial for understanding required fields and their scopes
 */
export async function getFamilyAttributeInfo(
  client: UnoPimClient,
  familyCode: string
): Promise<FamilyAttributeInfo> {
  // 1. Get family structure
  const familyResponse = await client.get<{
    code: string;
    attribute_groups: Array<{
      code: string;
      custom_attributes: Array<{ code: string; position: number }>;
    }>;
  }>(`/api/v1/rest/families/${familyCode}`);

  // Extract all attribute codes from the family
  const attributeCodes: string[] = [];
  for (const group of familyResponse.attribute_groups || []) {
    for (const attr of group.custom_attributes || []) {
      attributeCodes.push(attr.code);
    }
  }

  // 2. Fetch metadata for each attribute
  const attributes: AttributeMetadata[] = [];
  
  for (const code of attributeCodes) {
    try {
      const attrResponse = await client.get<{
        code: string;
        type: string;
        is_required: number | boolean;
        value_per_locale: number | boolean;
        value_per_channel: number | boolean;
        validation?: string | null;
      }>(`/api/v1/rest/attributes/${code}`);

      attributes.push({
        code: attrResponse.code,
        type: attrResponse.type,
        is_required: Boolean(attrResponse.is_required),
        value_per_locale: Boolean(attrResponse.value_per_locale),
        value_per_channel: Boolean(attrResponse.value_per_channel),
        validation: attrResponse.validation,
      });
    } catch {
      // Attribute might not exist, skip it
    }
  }

  // 3. Categorize attributes by scope
  const commonAttributes = attributes.filter(a => !a.value_per_locale && !a.value_per_channel);
  const localeAttributes = attributes.filter(a => a.value_per_locale && !a.value_per_channel);
  const channelAttributes = attributes.filter(a => !a.value_per_locale && a.value_per_channel);
  const channelLocaleAttributes = attributes.filter(a => a.value_per_locale && a.value_per_channel);
  const requiredAttributes = attributes.filter(a => a.is_required);

  return {
    familyCode,
    attributes,
    requiredAttributes,
    commonAttributes,
    localeAttributes,
    channelAttributes,
    channelLocaleAttributes,
  };
}

/**
 * Validates product values against family schema
 */
export function validateProductValues(
  values: Record<string, unknown>,
  familyInfo: FamilyAttributeInfo,
  locale: string,
  channel: string
): ValidationResult {
  const errors: Array<{ field: string; message: string }> = [];
  const warnings: Array<{ field: string; message: string }> = [];

  const common = (values.common || {}) as Record<string, unknown>;
  const localeSpecific = (values.locale_specific || {}) as Record<string, Record<string, unknown>>;
  const channelSpecific = (values.channel_specific || {}) as Record<string, Record<string, unknown>>;
  const channelLocaleSpecific = (values.channel_locale_specific || {}) as Record<string, Record<string, Record<string, unknown>>>;

  // Check required attributes
  for (const attr of familyInfo.requiredAttributes) {
    let hasValue = false;

    if (!attr.value_per_locale && !attr.value_per_channel) {
      // Should be in common
      hasValue = common[attr.code] !== undefined && common[attr.code] !== null && common[attr.code] !== '';
      if (!hasValue) {
        errors.push({ field: `common.${attr.code}`, message: `Required attribute '${attr.code}' is missing from common values` });
      }
    } else if (attr.value_per_locale && !attr.value_per_channel) {
      // Should be in locale_specific
      hasValue = localeSpecific[locale]?.[attr.code] !== undefined;
      if (!hasValue) {
        errors.push({ field: `locale_specific.${locale}.${attr.code}`, message: `Required attribute '${attr.code}' is missing for locale '${locale}'` });
      }
    } else if (!attr.value_per_locale && attr.value_per_channel) {
      // Should be in channel_specific
      hasValue = channelSpecific[channel]?.[attr.code] !== undefined;
      if (!hasValue) {
        errors.push({ field: `channel_specific.${channel}.${attr.code}`, message: `Required attribute '${attr.code}' is missing for channel '${channel}'` });
      }
    } else {
      // Should be in channel_locale_specific
      hasValue = channelLocaleSpecific[channel]?.[locale]?.[attr.code] !== undefined;
      if (!hasValue) {
        errors.push({ field: `channel_locale_specific.${channel}.${locale}.${attr.code}`, message: `Required attribute '${attr.code}' is missing for channel '${channel}' and locale '${locale}'` });
      }
    }
  }

  // Check for misplaced attributes (wrong scope)
  for (const [key, value] of Object.entries(common)) {
    if (key === 'sku') continue; // SKU is always in common
    const attr = familyInfo.attributes.find(a => a.code === key);
    if (attr && (attr.value_per_locale || attr.value_per_channel)) {
      warnings.push({ field: `common.${key}`, message: `Attribute '${key}' should not be in 'common' - it requires locale/channel scope` });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Structures product values correctly based on family schema
 * This automatically places attributes in the correct scope
 */
export function structureProductValues(
  rawValues: Record<string, unknown>,
  familyInfo: FamilyAttributeInfo,
  locale: string,
  channel: string
): Record<string, unknown> {
  const common: Record<string, unknown> = {};
  const localeSpecific: Record<string, Record<string, unknown>> = { [locale]: {} };
  const channelSpecific: Record<string, Record<string, unknown>> = { [channel]: {} };
  const channelLocaleSpecific: Record<string, Record<string, Record<string, unknown>>> = { [channel]: { [locale]: {} } };

  // Process each value and place it in the correct scope
  for (const [key, value] of Object.entries(rawValues)) {
    if (key === 'categories' || key === 'associations') {
      continue; // These are top-level, not scoped
    }

    const attr = familyInfo.attributes.find(a => a.code === key);
    
    if (!attr) {
      // Unknown attribute, put in common and let API validate
      common[key] = value;
      continue;
    }

    if (!attr.value_per_locale && !attr.value_per_channel) {
      common[key] = value;
    } else if (attr.value_per_locale && !attr.value_per_channel) {
      localeSpecific[locale][key] = value;
    } else if (!attr.value_per_locale && attr.value_per_channel) {
      channelSpecific[channel][key] = value;
    } else {
      channelLocaleSpecific[channel][locale][key] = value;
    }
  }

  // Always ensure sku is in common
  if (rawValues.sku) {
    common['sku'] = rawValues.sku;
  }

  const result: Record<string, unknown> = { common };
  
  if (Object.keys(localeSpecific[locale]).length > 0) {
    result.locale_specific = localeSpecific;
  }
  if (Object.keys(channelSpecific[channel]).length > 0) {
    result.channel_specific = channelSpecific;
  }
  if (Object.keys(channelLocaleSpecific[channel][locale]).length > 0) {
    result.channel_locale_specific = channelLocaleSpecific;
  }
  if (rawValues.categories) {
    result.categories = rawValues.categories;
  }
  if (rawValues.associations) {
    result.associations = rawValues.associations;
  }

  return result;
}

// ============================================================================
// Smart Create Product Input Schema and Implementation
// ============================================================================

export const SmartCreateProductInputSchema = z.object({
  sku: z.string(),
  family: z.string(),
  locale: z.string().default('en_US'),
  channel: z.string().default('default'),
  values: z.record(z.string(), z.unknown()).describe('Flat object with attribute values - will be auto-structured based on family schema'),
  categories: z.array(z.string()).optional(),
  validate_only: z.boolean().optional().default(false),
});

export type SmartCreateProductInput = z.infer<typeof SmartCreateProductInputSchema>;

/**
 * unopim_smart_create_product
 * Intelligently creates a product by:
 * 1. Fetching family schema to understand required fields and scopes
 * 2. Auto-structuring values into correct scope (common, locale_specific, etc.)
 * 3. Validating before submission
 * 4. Providing detailed error messages
 */
export async function smartCreateProduct(
  client: UnoPimClient,
  input: SmartCreateProductInput
): Promise<{
  success: boolean;
  product?: Product;
  validation: ValidationResult;
  family_info: {
    required_attributes: string[];
    common_attributes: string[];
    locale_attributes: string[];
    channel_locale_attributes: string[];
  };
  structured_values?: Record<string, unknown>;
  errors?: Array<{ field: string; message: string }>;
}> {
  try {
    // 1. Fetch family attribute info
    const familyInfo = await getFamilyAttributeInfo(client, input.family);

    // 2. Add SKU to values
    const valuesWithSku = {
      sku: input.sku,
      ...input.values,
    };

    // 3. Structure values based on family schema
    const structuredValues = structureProductValues(
      valuesWithSku,
      familyInfo,
      input.locale,
      input.channel
    );

    // Add categories if provided
    if (input.categories) {
      structuredValues.categories = input.categories;
    }

    // 4. Validate
    const validation = validateProductValues(
      structuredValues,
      familyInfo,
      input.locale,
      input.channel
    );

    const familyInfoSummary = {
      required_attributes: familyInfo.requiredAttributes.map(a => a.code),
      common_attributes: familyInfo.commonAttributes.map(a => a.code),
      locale_attributes: familyInfo.localeAttributes.map(a => a.code),
      channel_locale_attributes: familyInfo.channelLocaleAttributes.map(a => a.code),
    };

    // If validate_only, return validation result
    if (input.validate_only) {
      return {
        success: validation.valid,
        validation,
        family_info: familyInfoSummary,
        structured_values: structuredValues,
      };
    }

    // 5. If validation passed, create the product
    if (!validation.valid) {
      return {
        success: false,
        validation,
        family_info: familyInfoSummary,
        structured_values: structuredValues,
        errors: validation.errors,
      };
    }

    // 6. Create the product
    // SKU must be in values.common
    if (!structuredValues.common) {
      structuredValues.common = {};
    }
    (structuredValues.common as Record<string, unknown>)['sku'] = input.sku;

    // UnoPim requires these fields for product creation
    const productData = {
      parent: null,           // Required: null for standalone products
      family: input.family,
      type: 'simple',         // Required: 'simple' for non-configurable
      additional: null,       // Required: null for basic products
      values: structuredValues, // Values with categories INSIDE
    };

    const response = await client.post<{ data?: Product; success?: boolean; message?: string }>(
      '/api/v1/rest/products',
      productData
    );

    return {
      success: true,
      product: response.data || { sku: input.sku } as Product,
      validation,
      family_info: familyInfoSummary,
      structured_values: structuredValues,
    };
  } catch (error) {
    // Parse API error for detailed feedback
    const errorStr = String(error);
    const errors: Array<{ field: string; message: string }> = [];
    
    // Try to extract validation errors from API response
    try {
      const match = errorStr.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.errors) {
          for (const [field, messages] of Object.entries(parsed.errors)) {
            const msgArray = Array.isArray(messages) ? messages : [messages];
            for (const msg of msgArray) {
              errors.push({ field, message: String(msg) });
            }
          }
        }
      }
    } catch {
      errors.push({ field: 'unknown', message: errorStr });
    }

    // Still try to get family info for the error response
    let familyInfoSummary = {
      required_attributes: [] as string[],
      common_attributes: [] as string[],
      locale_attributes: [] as string[],
      channel_locale_attributes: [] as string[],
    };
    
    try {
      const familyInfo = await getFamilyAttributeInfo(client, input.family);
      familyInfoSummary = {
        required_attributes: familyInfo.requiredAttributes.map(a => a.code),
        common_attributes: familyInfo.commonAttributes.map(a => a.code),
        locale_attributes: familyInfo.localeAttributes.map(a => a.code),
        channel_locale_attributes: familyInfo.channelLocaleAttributes.map(a => a.code),
      };
    } catch {
      // Ignore
    }

    return {
      success: false,
      validation: { valid: false, errors, warnings: [] },
      family_info: familyInfoSummary,
      errors,
    };
  }
}

// ============================================================================
// Get Family Schema Tool
// ============================================================================

export const GetFamilySchemaInputSchema = z.object({
  family: z.string(),
});

export type GetFamilySchemaInput = z.infer<typeof GetFamilySchemaInputSchema>;

/**
 * unopim_get_family_schema
 * Returns detailed schema information for a product family
 * Useful for understanding what attributes are needed and their scopes
 */
export async function getFamilySchema(
  client: UnoPimClient,
  input: GetFamilySchemaInput
): Promise<{
  family: string;
  total_attributes: number;
  required_attributes: Array<{ code: string; type: string; scope: string }>;
  optional_attributes: Array<{ code: string; type: string; scope: string }>;
  attribute_scopes: {
    common: string[];
    locale_specific: string[];
    channel_specific: string[];
    channel_locale_specific: string[];
  };
  example_values_structure: Record<string, unknown>;
}> {
  const familyInfo = await getFamilyAttributeInfo(client, input.family);

  const getScopeLabel = (attr: AttributeMetadata): string => {
    if (!attr.value_per_locale && !attr.value_per_channel) return 'common';
    if (attr.value_per_locale && !attr.value_per_channel) return 'locale_specific';
    if (!attr.value_per_locale && attr.value_per_channel) return 'channel_specific';
    return 'channel_locale_specific';
  };

  const requiredAttrs = familyInfo.requiredAttributes.map(a => ({
    code: a.code,
    type: a.type,
    scope: getScopeLabel(a),
  }));

  const optionalAttrs = familyInfo.attributes
    .filter(a => !a.is_required)
    .map(a => ({
      code: a.code,
      type: a.type,
      scope: getScopeLabel(a),
    }));

  // Build example structure
  const exampleStructure: Record<string, unknown> = {
    common: {} as Record<string, string>,
  };

  for (const attr of familyInfo.commonAttributes) {
    (exampleStructure.common as Record<string, string>)[attr.code] = `<${attr.type}${attr.is_required ? ', REQUIRED' : ''}>`;
  }

  if (familyInfo.localeAttributes.length > 0) {
    exampleStructure.locale_specific = {
      'en_US': {} as Record<string, string>,
    };
    for (const attr of familyInfo.localeAttributes) {
      ((exampleStructure.locale_specific as Record<string, Record<string, string>>)['en_US'])[attr.code] = `<${attr.type}${attr.is_required ? ', REQUIRED' : ''}>`;
    }
  }

  if (familyInfo.channelAttributes.length > 0) {
    exampleStructure.channel_specific = {
      'default': {} as Record<string, string>,
    };
    for (const attr of familyInfo.channelAttributes) {
      ((exampleStructure.channel_specific as Record<string, Record<string, string>>)['default'])[attr.code] = `<${attr.type}${attr.is_required ? ', REQUIRED' : ''}>`;
    }
  }

  if (familyInfo.channelLocaleAttributes.length > 0) {
    exampleStructure.channel_locale_specific = {
      'default': {
        'en_US': {} as Record<string, string>,
      },
    };
    for (const attr of familyInfo.channelLocaleAttributes) {
      ((exampleStructure.channel_locale_specific as Record<string, Record<string, Record<string, string>>>)['default']['en_US'])[attr.code] = `<${attr.type}${attr.is_required ? ', REQUIRED' : ''}>`;
    }
  }

  return {
    family: input.family,
    total_attributes: familyInfo.attributes.length,
    required_attributes: requiredAttrs,
    optional_attributes: optionalAttrs,
    attribute_scopes: {
      common: familyInfo.commonAttributes.map(a => a.code),
      locale_specific: familyInfo.localeAttributes.map(a => a.code),
      channel_specific: familyInfo.channelAttributes.map(a => a.code),
      channel_locale_specific: familyInfo.channelLocaleAttributes.map(a => a.code),
    },
    example_values_structure: exampleStructure,
  };
}

// ============================================================================
// Media Upload
// ============================================================================

export const UploadProductMediaInputSchema = z.object({
  sku: z.string(),
  attribute: z.string(),
  file_url: z.string().optional(),
  file_base64: z.string().optional(),
  filename: z.string().optional(),
});

export type UploadProductMediaInput = z.infer<typeof UploadProductMediaInputSchema>;

// Response type for media upload
interface MediaUploadResponse {
  success?: boolean;
  message?: string;
  data?: { filePath?: string; attribute?: string; sku?: string };
  filePath?: string;
  errors?: Record<string, string[]>;
}

/**
 * Upload media file to a product attribute
 * Supports either a URL to fetch the file from, or base64-encoded file data
 */
export async function uploadProductMedia(
  client: UnoPimClient,
  input: UploadProductMediaInput
): Promise<{
  success: boolean;
  message: string;
  filePath?: string;
  error?: string;
}> {
  try {
    let arrayBuffer: ArrayBuffer;
    let filename: string;

    if (input.file_url) {
      // Fetch file from URL
      const response = await fetch(input.file_url);
      if (!response.ok) {
        return {
          success: false,
          message: 'Failed to fetch file from URL',
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
      arrayBuffer = await response.arrayBuffer();
      
      // Extract filename from URL or use provided
      filename = input.filename || input.file_url.split('/').pop() || 'uploaded-file';
    } else if (input.file_base64) {
      // Decode base64
      const buffer = Buffer.from(input.file_base64, 'base64');
      arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      filename = input.filename || 'uploaded-file.jpg';
    } else {
      return {
        success: false,
        message: 'Either file_url or file_base64 must be provided',
      };
    }

    // Create FormData for multipart upload
    const formData = new FormData();
    const blob = new Blob([arrayBuffer]);
    formData.append('file', blob, filename);
    formData.append('sku', input.sku);
    formData.append('attribute', input.attribute);

    // Make the request
    const result = await client.postMultipart<MediaUploadResponse>('/media-files/product', formData);
    
    if (result.success) {
      return {
        success: true,
        message: result.message || 'Product file uploaded successfully.',
        filePath: result.data?.filePath || result.filePath,
      };
    } else {
      return {
        success: false,
        message: result.message || 'Upload failed',
        error: JSON.stringify(result.errors || result),
      };
    }
  } catch (error) {
    return {
      success: false,
      message: 'Failed to upload media',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export const UploadCategoryMediaInputSchema = z.object({
  code: z.string(),
  category_field: z.string(),
  file_url: z.string().optional(),
  file_base64: z.string().optional(),
  filename: z.string().optional(),
});

export type UploadCategoryMediaInput = z.infer<typeof UploadCategoryMediaInputSchema>;

/**
 * Upload media file to a category field
 */
export async function uploadCategoryMedia(
  client: UnoPimClient,
  input: UploadCategoryMediaInput
): Promise<{
  success: boolean;
  message: string;
  filePath?: string;
  error?: string;
}> {
  try {
    let arrayBuffer: ArrayBuffer;
    let filename: string;

    if (input.file_url) {
      const response = await fetch(input.file_url);
      if (!response.ok) {
        return {
          success: false,
          message: 'Failed to fetch file from URL',
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
      arrayBuffer = await response.arrayBuffer();
      filename = input.filename || input.file_url.split('/').pop() || 'uploaded-file';
    } else if (input.file_base64) {
      const buffer = Buffer.from(input.file_base64, 'base64');
      arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      filename = input.filename || 'uploaded-file.jpg';
    } else {
      return {
        success: false,
        message: 'Either file_url or file_base64 must be provided',
      };
    }

    const formData = new FormData();
    const blob = new Blob([arrayBuffer]);
    formData.append('file', blob, filename);
    formData.append('code', input.code);
    formData.append('category_field', input.category_field);

    const result = await client.postMultipart<MediaUploadResponse>('/media-files/category', formData);
    
    if (result.success) {
      return {
        success: true,
        message: result.message || 'Category file uploaded successfully.',
        filePath: result.data?.filePath || result.filePath,
      };
    } else {
      return {
        success: false,
        message: result.message || 'Upload failed',
        error: JSON.stringify(result.errors || result),
      };
    }
  } catch (error) {
    return {
      success: false,
      message: 'Failed to upload media',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
