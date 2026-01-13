/**
 * Example usage of UnoPim client
 * Demonstrates common API operations
 */

import { UnoPimClient } from './unopim-client.js';
import { OAuthManager } from '../auth/oauth.js';
import type { Attribute, Family, Product, ListResponse } from '../types/unopim.js';

/**
 * Example: Initialize the client
 */
export function initializeClient(baseUrl: string, credentials: {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}): UnoPimClient {
  const authManager = new OAuthManager(baseUrl, credentials);
  return new UnoPimClient(baseUrl, authManager);
}

/**
 * Example: Fetch all attributes with pagination
 */
export async function fetchAllAttributes(
  client: UnoPimClient,
  page: number = 1,
  limit: number = 100
): Promise<Attribute[]> {
  const url = client.buildUrl('/api/v1/rest/attributes', { page, limit });
  const response = await client.get<ListResponse<Attribute>>(url);
  return response.data || [];
}

/**
 * Example: Create a new attribute
 */
export async function createAttribute(
  client: UnoPimClient,
  attribute: Partial<Attribute>
): Promise<Attribute> {
  const response = await client.post<{ data: Attribute }>(
    '/api/v1/rest/attributes',
    attribute
  );
  return response.data;
}

/**
 * Example: Get a specific family
 */
export async function getFamily(
  client: UnoPimClient,
  familyCode: string
): Promise<Family> {
  const response = await client.get<{ data: Family }>(
    `/api/v1/rest/families/${familyCode}`
  );
  return response.data;
}

/**
 * Example: Create a product
 */
export async function createProduct(
  client: UnoPimClient,
  product: Partial<Product>
): Promise<Product> {
  const response = await client.post<{ data: Product }>(
    '/api/v1/rest/products',
    product
  );
  return response.data;
}

/**
 * Example: Update a product
 */
export async function updateProduct(
  client: UnoPimClient,
  sku: string,
  updates: Partial<Product>
): Promise<Product> {
  const response = await client.put<{ data: Product }>(
    `/api/v1/rest/products/${sku}`,
    updates
  );
  return response.data;
}

/**
 * Example: Search products with filters
 */
export async function searchProducts(
  client: UnoPimClient,
  filters: {
    family?: string;
    category?: string;
    page?: number;
    limit?: number;
  }
): Promise<Product[]> {
  const url = client.buildUrl('/api/v1/rest/products', filters);
  const response = await client.get<ListResponse<Product>>(url);
  return response.data || [];
}
