/**
 * Schema inspection tools for UnoPim
 * Provides read-only access to the datamodel structure
 */

import { z } from 'zod';
import type { UnoPimClient } from '../client/unopim-client.js';
import type { Schema, Attribute, Family, Category, Channel, Locale, Currency, ListResponse, AttributeGroup } from '../types/unopim.js';

// ============================================================================
// Input Schemas
// ============================================================================

export const GetSchemaInputSchema = z.object({
  include_attributes: z.boolean().optional().default(true),
  include_families: z.boolean().optional().default(true),
  include_categories: z.boolean().optional().default(true),
  include_channels: z.boolean().optional().default(false),
  include_locales: z.boolean().optional().default(false),
});

export const GetAttributesInputSchema = z.object({
  filter_by_type: z.string().optional(),
  filter_by_group: z.string().optional(),
  limit: z.number().optional().default(100),
  page: z.number().optional().default(1),
});

export const GetFamiliesInputSchema = z.object({
  limit: z.number().optional().default(100),
  page: z.number().optional().default(1),
});

export type GetSchemaInput = z.infer<typeof GetSchemaInputSchema>;
export type GetAttributesInput = z.infer<typeof GetAttributesInputSchema>;
export type GetFamiliesInput = z.infer<typeof GetFamiliesInputSchema>;

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * unopim_get_schema
 * Fetches complete datamodel overview from UnoPim
 */
export async function getSchema(
  client: UnoPimClient,
  input: GetSchemaInput
): Promise<Schema> {
  const schema: Schema = {
    attributes: [],
    attribute_groups: [],
    families: [],
    categories: [],
  };

  try {
    // Fetch attributes
    if (input.include_attributes) {
      const attributesResponse = await client.get<ListResponse<Attribute>>('/api/v1/rest/attributes');
      schema.attributes = attributesResponse.data || [];
    }

    // Fetch attribute groups
    if (input.include_attributes) {
      const groupsResponse = await client.get<ListResponse<AttributeGroup>>('/api/v1/rest/attribute-groups');
      schema.attribute_groups = groupsResponse.data || [];
    }

    // Fetch families
    if (input.include_families) {
      const familiesResponse = await client.get<ListResponse<Family>>('/api/v1/rest/families');
      schema.families = familiesResponse.data || [];
    }

    // Fetch categories
    if (input.include_categories) {
      const categoriesResponse = await client.get<ListResponse<Category>>('/api/v1/rest/categories');
      schema.categories = categoriesResponse.data || [];
    }

    // Fetch channels
    if (input.include_channels) {
      const channelsResponse = await client.get<ListResponse<Channel>>('/api/v1/rest/channels');
      schema.channels = channelsResponse.data || [];
    }

    // Fetch locales
    if (input.include_locales) {
      const localesResponse = await client.get<ListResponse<Locale>>('/api/v1/rest/locales');
      schema.locales = localesResponse.data || [];
    }

    return schema;
  } catch (error) {
    throw new Error(`Failed to fetch schema: ${error}`);
  }
}

/**
 * unopim_get_attributes
 * Lists all attributes with optional filtering
 */
export async function getAttributes(
  client: UnoPimClient,
  input: GetAttributesInput
): Promise<{
  attributes: Attribute[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_items: number;
  };
}> {
  try {
    // Build query parameters
    const params: Record<string, string | number> = {
      page: input.page,
      limit: input.limit,
    };

    if (input.filter_by_type) {
      params.type = input.filter_by_type;
    }

    if (input.filter_by_group) {
      params.group = input.filter_by_group;
    }

    const url = client.buildUrl('/api/v1/rest/attributes', params);
    const response = await client.get<ListResponse<Attribute>>(url);

    return {
      attributes: response.data || [],
      pagination: {
        current_page: response.meta?.current_page || input.page,
        total_pages: response.meta?.last_page || 1,
        total_items: response.meta?.total || 0,
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch attributes: ${error}`);
  }
}

/**
 * unopim_get_families
 * Lists all product families
 */
export async function getFamilies(
  client: UnoPimClient,
  input: GetFamiliesInput
): Promise<{
  families: Family[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_items: number;
  };
}> {
  try {
    const url = client.buildUrl('/api/v1/rest/families', {
      page: input.page,
      limit: input.limit,
    });

    const response = await client.get<ListResponse<Family>>(url);

    return {
      families: response.data || [],
      pagination: {
        current_page: response.meta?.current_page || input.page,
        total_pages: response.meta?.last_page || 1,
        total_items: response.meta?.total || 0,
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch families: ${error}`);
  }
}
