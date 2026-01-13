/**
 * Attribute management tools for UnoPim
 * Handles attribute creation and option management
 */

import { z } from 'zod';
import type { UnoPimClient } from '../client/unopim-client.js';
import type { Attribute, AttributeOption, AttributeType } from '../types/unopim.js';

// ============================================================================
// Input Schemas
// ============================================================================

// UnoPim supported attribute types based on API documentation
// For decimal/number values, use type='text' with validation='decimal'
const AttributeTypeSchema = z.enum([
  'text',
  'textarea',
  'boolean',
  'price',
  'select',
  'multiselect',
  'image',
]);

// Validation rules - use 'decimal' for numeric text fields
const ValidationRuleSchema = z.enum(['email', 'url', 'regexp', 'decimal', 'number']).nullable().optional();

export const CreateAttributeInputSchema = z.object({
  code: z.string().regex(/^[a-z0-9_]+$/, 'Code must be lowercase alphanumeric with underscores'),
  type: AttributeTypeSchema,
  labels: z.record(z.string(), z.string()).refine(
    (labels) => Object.keys(labels).length > 0,
    'At least one label is required'
  ),
  is_required: z.boolean().optional().default(false),
  is_unique: z.boolean().optional().default(false),
  is_configurable: z.boolean().optional().default(false),
  value_per_locale: z.boolean().optional().default(false),
  value_per_channel: z.boolean().optional().default(false),
  validation: ValidationRuleSchema,
  regex_pattern: z.string().optional(),
  default_value: z.string().optional(),
  position: z.number().optional(),
  enable_wysiwyg: z.boolean().optional(),
});

export const CreateAttributeOptionsInputSchema = z.object({
  attribute_code: z.string(),
  options: z.array(z.object({
    code: z.string().regex(/^[a-z0-9_]+$/, 'Option code must be lowercase alphanumeric with underscores'),
    sort_order: z.number().optional(),
    labels: z.record(z.string(), z.string()).refine(
      (labels) => Object.keys(labels).length > 0,
      'At least one label is required'
    ),
  })).min(1, 'At least one option is required'),
});

export const GetAttributeOptionsInputSchema = z.object({
  attribute_code: z.string(),
});

export type CreateAttributeInput = z.infer<typeof CreateAttributeInputSchema>;
export type CreateAttributeOptionsInput = z.infer<typeof CreateAttributeOptionsInputSchema>;
export type GetAttributeOptionsInput = z.infer<typeof GetAttributeOptionsInputSchema>;

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * unopim_create_attribute
 * Creates a new attribute in UnoPim
 */
export async function createAttribute(
  client: UnoPimClient,
  input: CreateAttributeInput
): Promise<{
  success: boolean;
  attribute: Attribute;
  message?: string;
}> {
  try {
    // Prepare attribute data
    const attributeData: Record<string, unknown> = {
      code: input.code,
      type: input.type,
      labels: input.labels,
      is_required: input.is_required,
      is_unique: input.is_unique,
      is_configurable: input.is_configurable,
      value_per_locale: input.value_per_locale,
      value_per_channel: input.value_per_channel,
    };

    // Add optional fields
    if (input.validation !== undefined) {
      attributeData.validation = input.validation;
    }

    if (input.regex_pattern) {
      attributeData.regex_pattern = input.regex_pattern;
    }

    if (input.default_value !== undefined) {
      attributeData.default_value = input.default_value;
    }

    if (input.position !== undefined) {
      attributeData.position = input.position;
    }

    if (input.enable_wysiwyg !== undefined) {
      attributeData.enable_wysiwyg = input.enable_wysiwyg;
    }

    const response = await client.post<{ data: Attribute }>(
      '/api/v1/rest/attributes',
      attributeData
    );

    return {
      success: true,
      attribute: response.data,
      message: `Attribute '${input.code}' created successfully`,
    };
  } catch (error) {
    throw new Error(`Failed to create attribute: ${error}`);
  }
}

/**
 * unopim_create_attribute_options
 * Creates options for select/multiselect attributes
 * API expects an array of options and creates them all at once
 */
export async function createAttributeOptions(
  client: UnoPimClient,
  input: CreateAttributeOptionsInput
): Promise<{
  success: boolean;
  created_count: number;
  options: AttributeOption[];
  message?: string;
}> {
  try {
    // API expects array format: POST /attributes/{code}/options with body as array
    const optionsPayload = input.options.map(opt => ({
      code: opt.code,
      sort_order: opt.sort_order,
      labels: opt.labels,
    }));

    const response = await client.post<{ success?: boolean; message?: string } | AttributeOption[]>(
      `/api/v1/rest/attributes/${input.attribute_code}/options`,
      optionsPayload
    );

    return {
      success: true,
      created_count: input.options.length,
      options: input.options as AttributeOption[],
      message: `Created ${input.options.length} options for attribute '${input.attribute_code}'`,
    };
  } catch (error) {
    throw new Error(`Failed to create attribute options: ${error}`);
  }
}

/**
 * unopim_get_attribute_options
 * Gets all options for a select/multiselect attribute
 */
export async function getAttributeOptions(
  client: UnoPimClient,
  input: GetAttributeOptionsInput
): Promise<{
  attribute_code: string;
  options: AttributeOption[];
  total: number;
}> {
  try {
    // API returns array directly, not { data: [...] }
    const response = await client.get<AttributeOption[]>(
      `/api/v1/rest/attributes/${input.attribute_code}/options`
    );

    // Handle both array response and wrapped response
    const options = Array.isArray(response) ? response : (response as any).data || [];

    return {
      attribute_code: input.attribute_code,
      options: options,
      total: options.length,
    };
  } catch (error) {
    throw new Error(`Failed to get attribute options for '${input.attribute_code}': ${error}`);
  }
}
