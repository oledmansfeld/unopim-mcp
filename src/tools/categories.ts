/**
 * Category management tools for UnoPim
 * Handles category retrieval and creation
 */

import { z } from 'zod';
import type { UnoPimClient } from '../client/unopim-client.js';
import type { Category, ListResponse } from '../types/unopim.js';

// ============================================================================
// Input Schemas
// ============================================================================

export const GetCategoriesInputSchema = z.object({
  parent_code: z.string().optional(),
  limit: z.number().optional().default(100),
  page: z.number().optional().default(1),
});

export const CreateCategoryInputSchema = z.object({
  code: z.string().regex(/^[a-z0-9_]+$/, 'Code must be lowercase alphanumeric with underscores'),
  parent: z.string().optional(),
  labels: z.record(z.string(), z.string()).refine(
    (labels) => Object.keys(labels).length > 0,
    'At least one label is required'
  ),
  additional_data: z.object({
    common: z.record(z.string(), z.unknown()).optional(),
    locale_specific: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  }).optional(),
});

export type GetCategoriesInput = z.infer<typeof GetCategoriesInputSchema>;
export type CreateCategoryInput = z.infer<typeof CreateCategoryInputSchema>;

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * unopim_get_categories
 * Retrieves category tree with optional filtering
 */
export async function getCategories(
  client: UnoPimClient,
  input: GetCategoriesInput
): Promise<{
  categories: Category[];
}> {
  try {
    const params: Record<string, string | number> = {
      page: input.page,
      limit: input.limit,
    };

    if (input.parent_code) {
      params.parent = input.parent_code;
    }

    const url = client.buildUrl('/api/v1/rest/categories', params);
    const response = await client.get<ListResponse<Category>>(url);

    return {
      categories: response.data || [],
    };
  } catch (error) {
    throw new Error(`Failed to fetch categories: ${error}`);
  }
}

/**
 * unopim_create_category
 * Creates a new category with optional parent
 */
export async function createCategory(
  client: UnoPimClient,
  input: CreateCategoryInput
): Promise<{
  success: boolean;
  category: Category;
}> {
  try {
    const categoryData: Record<string, unknown> = {
      code: input.code,
      labels: input.labels,
    };

    if (input.parent) {
      categoryData.parent = input.parent;
    }

    if (input.additional_data) {
      categoryData.additional_data = input.additional_data;
    }

    const response = await client.post<{ data: Category }>(
      '/api/v1/rest/categories',
      categoryData
    );

    return {
      success: true,
      category: response.data,
    };
  } catch (error) {
    throw new Error(`Failed to create category: ${error}`);
  }
}
