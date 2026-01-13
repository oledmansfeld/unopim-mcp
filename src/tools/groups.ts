/**
 * Attribute group management tools for UnoPim
 * Handles attribute group creation and retrieval
 */

import { z } from 'zod';
import type { UnoPimClient } from '../client/unopim-client.js';
import type { AttributeGroup } from '../types/unopim.js';

// ============================================================================
// Input Schemas
// ============================================================================

export const GetAttributeGroupsInputSchema = z.object({
  limit: z.number().optional().default(100),
  page: z.number().optional().default(1),
});

export const CreateAttributeGroupInputSchema = z.object({
  code: z.string().regex(/^[a-z0-9_]+$/, 'Code must be lowercase alphanumeric with underscores'),
  labels: z.record(z.string(), z.string()).refine(
    (labels) => Object.keys(labels).length > 0,
    'At least one label is required'
  ),
  position: z.number().optional(),
});

export type GetAttributeGroupsInput = z.infer<typeof GetAttributeGroupsInputSchema>;
export type CreateAttributeGroupInput = z.infer<typeof CreateAttributeGroupInputSchema>;

// ============================================================================
// Tool Implementations
// ============================================================================

interface ListResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
}

/**
 * unopim_get_attribute_groups
 * Gets all attribute groups from UnoPim
 */
export async function getAttributeGroups(
  client: UnoPimClient,
  input: GetAttributeGroupsInput
): Promise<{
  groups: AttributeGroup[];
  total: number;
  page: number;
  last_page: number;
}> {
  try {
    const params = new URLSearchParams();
    if (input.limit) params.append('limit', input.limit.toString());
    if (input.page) params.append('page', input.page.toString());

    const response = await client.get<ListResponse<AttributeGroup>>(
      `/api/v1/rest/attribute-groups?${params.toString()}`
    );

    return {
      groups: response.data,
      total: response.total,
      page: response.current_page,
      last_page: response.last_page,
    };
  } catch (error) {
    throw new Error(`Failed to get attribute groups: ${error}`);
  }
}

/**
 * unopim_create_attribute_group
 * Creates a logical grouping of attributes
 */
export async function createAttributeGroup(
  client: UnoPimClient,
  input: CreateAttributeGroupInput
): Promise<{
  success: boolean;
  attribute_group: AttributeGroup;
}> {
  try {
    const groupData: Record<string, unknown> = {
      code: input.code,
      labels: input.labels,
    };

    if (input.position !== undefined) {
      groupData.position = input.position;
    }

    const response = await client.post<{ data: AttributeGroup }>(
      '/api/v1/rest/attribute-groups',
      groupData
    );

    return {
      success: true,
      attribute_group: response.data,
    };
  } catch (error) {
    throw new Error(`Failed to create attribute group: ${error}`);
  }
}
