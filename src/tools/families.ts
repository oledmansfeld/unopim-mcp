/**
 * Family management tools for UnoPim
 * Handles product family creation and updates
 */

import { z } from 'zod';
import type { UnoPimClient } from '../client/unopim-client.js';
import type { Family, FamilyAttributeGroup } from '../types/unopim.js';

// ============================================================================
// Input Schemas
// ============================================================================

// Position is REQUIRED by UnoPim API
const FamilyAttributeAssignmentSchema = z.object({
  code: z.string(),
  position: z.number(),
});

// attribute_groups with position and custom_attributes are REQUIRED
const FamilyAttributeGroupSchema = z.object({
  code: z.string(),
  position: z.number(),
  custom_attributes: z.array(FamilyAttributeAssignmentSchema),
});

export const CreateFamilyInputSchema = z.object({
  code: z.string().regex(/^[a-z0-9_]+$/, 'Code must be lowercase alphanumeric with underscores'),
  labels: z.record(z.string(), z.string()).refine(
    (labels) => Object.keys(labels).length > 0,
    'At least one label is required'
  ),
  attribute_groups: z.array(FamilyAttributeGroupSchema),
});

export const UpdateFamilyInputSchema = z.object({
  code: z.string(),
  add_attributes: z.array(z.object({
    group_code: z.string(),
    attribute_code: z.string(),
    position: z.number().optional(),
  })).optional(),
  remove_attributes: z.array(z.object({
    attribute_code: z.string(),
  })).optional(),
  update_labels: z.record(z.string(), z.string()).optional(),
});

export type CreateFamilyInput = z.infer<typeof CreateFamilyInputSchema>;
export type UpdateFamilyInput = z.infer<typeof UpdateFamilyInputSchema>;

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * unopim_create_family
 * Creates a product family with associated attributes
 */
export async function createFamily(
  client: UnoPimClient,
  input: CreateFamilyInput
): Promise<{
  success: boolean;
  family: Family;
}> {
  try {
    const familyData = {
      code: input.code,
      labels: input.labels,
      attribute_groups: input.attribute_groups,
    };

    const response = await client.post<{ data: Family }>(
      '/api/v1/rest/families',
      familyData
    );

    return {
      success: true,
      family: response.data,
    };
  } catch (error) {
    throw new Error(`Failed to create family: ${error}`);
  }
}

/**
 * unopim_update_family
 * Updates an existing family with new attributes or labels
 */
export async function updateFamily(
  client: UnoPimClient,
  input: UpdateFamilyInput
): Promise<{
  success: boolean;
  family: Family;
}> {
  try {
    // First, get the existing family
    const existingFamily = await client.get<{ data: Family }>(
      `/api/v1/rest/families/${input.code}`
    );

    const family = existingFamily.data;

    // Update labels if provided
    if (input.update_labels) {
      family.labels = {
        ...family.labels,
        ...input.update_labels,
      };
    }

    // Add new attributes
    if (input.add_attributes && input.add_attributes.length > 0) {
      for (const attr of input.add_attributes) {
        // Find the attribute group
        const group = family.attribute_groups.find(g => g.code === attr.group_code);

        if (!group) {
          throw new Error(`Attribute group '${attr.group_code}' not found in family`);
        }

        // Check if attribute already exists
        const exists = group.custom_attributes.some(a => a.code === attr.attribute_code);
        if (!exists) {
          group.custom_attributes.push({
            code: attr.attribute_code,
            position: attr.position || group.custom_attributes.length + 1,
          });
        }
      }
    }

    // Remove attributes
    if (input.remove_attributes && input.remove_attributes.length > 0) {
      for (const attr of input.remove_attributes) {
        for (const group of family.attribute_groups) {
          group.custom_attributes = group.custom_attributes.filter(
            a => a.code !== attr.attribute_code
          );
        }
      }
    }

    // Update the family
    const response = await client.put<{ data: Family }>(
      `/api/v1/rest/families/${input.code}`,
      family
    );

    return {
      success: true,
      family: response.data,
    };
  } catch (error) {
    throw new Error(`Failed to update family: ${error}`);
  }
}
