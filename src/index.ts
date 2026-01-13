#!/usr/bin/env node

/**
 * UnoPim MCP Server
 * Model Context Protocol server for UnoPim PIM system
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { loadConfig } from './config.js';
import { OAuthManager } from './auth/oauth.js';
import { UnoPimClient } from './client/unopim-client.js';

// Import tool implementations
import {
  getSchema,
  getAttributes,
  getFamilies,
  GetSchemaInputSchema,
  GetAttributesInputSchema,
  GetFamiliesInputSchema,
} from './tools/schema.js';

import {
  createAttribute,
  createAttributeOptions,
  getAttributeOptions,
  CreateAttributeInputSchema,
  CreateAttributeOptionsInputSchema,
  GetAttributeOptionsInputSchema,
} from './tools/attributes.js';

import {
  createAttributeGroup,
  CreateAttributeGroupInputSchema,
} from './tools/groups.js';

import {
  createFamily,
  updateFamily,
  CreateFamilyInputSchema,
  UpdateFamilyInputSchema,
} from './tools/families.js';

import {
  getCategories,
  createCategory,
  GetCategoriesInputSchema,
  CreateCategoryInputSchema,
} from './tools/categories.js';

import {
  createProduct,
  createConfigurableProduct,
  bulkCreateProducts,
  getProducts,
  getProduct,
  updateProduct,
  upsertProduct,
  CreateProductInputSchema,
  CreateConfigurableProductInputSchema,
  BulkCreateProductsInputSchema,
  GetProductsInputSchema,
  GetProductInputSchema,
  UpdateProductInputSchema,
  UpsertProductInputSchema,
} from './tools/products.js';

// ============================================================================
// Server Setup
// ============================================================================

class UnoPimMcpServer {
  private server: Server;
  private client: UnoPimClient;

  constructor() {
    // Load configuration
    const config = loadConfig();

    // Initialize OAuth manager
    const authManager = new OAuthManager(config.baseUrl, {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      username: config.username,
      password: config.password,
    });

    // Initialize UnoPim client
    this.client = new UnoPimClient(config.baseUrl, authManager);

    // Initialize MCP server
    this.server = new Server(
      {
        name: 'unopim-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // Schema Tools
        {
          name: 'unopim_get_schema',
          description: 'Fetch complete datamodel overview from UnoPim including attributes, families, categories, channels, and locales',
          inputSchema: {
            type: 'object',
            properties: {
              include_attributes: { type: 'boolean', description: 'Include attributes in response', default: true },
              include_families: { type: 'boolean', description: 'Include families in response', default: true },
              include_categories: { type: 'boolean', description: 'Include categories in response', default: true },
              include_channels: { type: 'boolean', description: 'Include channels in response', default: false },
              include_locales: { type: 'boolean', description: 'Include locales in response', default: false },
            },
          },
        },
        {
          name: 'unopim_get_attributes',
          description: 'List all attributes with optional filtering by type or group',
          inputSchema: {
            type: 'object',
            properties: {
              filter_by_type: { type: 'string', description: 'Filter by attribute type (e.g., select, text, boolean)' },
              filter_by_group: { type: 'string', description: 'Filter by attribute group code' },
              limit: { type: 'number', description: 'Number of results per page', default: 100 },
              page: { type: 'number', description: 'Page number', default: 1 },
            },
          },
        },
        {
          name: 'unopim_get_families',
          description: 'List all product families',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Number of results per page', default: 100 },
              page: { type: 'number', description: 'Page number', default: 1 },
            },
          },
        },

        // Attribute Tools
        {
          name: 'unopim_create_attribute',
          description: 'Create a new attribute in UnoPim. Supports types: text, textarea, boolean, date, datetime, number, decimal, price, select, multiselect, image, file',
          inputSchema: {
            type: 'object',
            properties: {
              code: { type: 'string', description: 'Unique attribute code (snake_case)' },
              type: { type: 'string', enum: ['text', 'textarea', 'boolean', 'date', 'datetime', 'number', 'decimal', 'price', 'select', 'multiselect', 'image', 'file'] },
              labels: { type: 'object', description: 'Labels for each locale (e.g., {"en_US": "Name", "da_DK": "Navn"})' },
              is_required: { type: 'boolean', default: false },
              is_unique: { type: 'boolean', default: false },
              is_configurable: { type: 'boolean', description: 'Use for product variants', default: false },
              value_per_locale: { type: 'boolean', default: false },
              value_per_channel: { type: 'boolean', default: false },
              validation: { type: 'string', enum: ['email', 'url', 'regexp', null] },
              regex_pattern: { type: 'string', description: 'Regex pattern if validation is regexp' },
              default_value: { type: 'string' },
              position: { type: 'number' },
              enable_wysiwyg: { type: 'boolean', description: 'Enable WYSIWYG editor for textarea' },
            },
            required: ['code', 'type', 'labels'],
          },
        },
        {
          name: 'unopim_create_attribute_options',
          description: 'Create options for select or multiselect attributes',
          inputSchema: {
            type: 'object',
            properties: {
              attribute_code: { type: 'string', description: 'The attribute code to add options to' },
              options: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', description: 'Option code (snake_case)' },
                    sort_order: { type: 'number' },
                    labels: { type: 'object', description: 'Labels for each locale' },
                  },
                  required: ['code', 'labels'],
                },
              },
            },
            required: ['attribute_code', 'options'],
          },
        },
        {
          name: 'unopim_get_attribute_options',
          description: 'Get all options for a select/multiselect attribute. Use this to check which options already exist.',
          inputSchema: {
            type: 'object',
            properties: {
              attribute_code: { type: 'string', description: 'The attribute code (e.g., "color", "size")' },
            },
            required: ['attribute_code'],
          },
        },

        // Attribute Group Tools
        {
          name: 'unopim_create_attribute_group',
          description: 'Create a logical grouping of attributes',
          inputSchema: {
            type: 'object',
            properties: {
              code: { type: 'string', description: 'Unique group code (snake_case)' },
              labels: { type: 'object', description: 'Labels for each locale' },
              position: { type: 'number' },
            },
            required: ['code', 'labels'],
          },
        },

        // Family Tools
        {
          name: 'unopim_create_family',
          description: 'Create a product family with associated attribute groups and attributes',
          inputSchema: {
            type: 'object',
            properties: {
              code: { type: 'string', description: 'Unique family code (snake_case)' },
              labels: { type: 'object', description: 'Labels for each locale' },
              attribute_groups: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', description: 'Attribute group code' },
                    position: { type: 'number' },
                    custom_attributes: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          code: { type: 'string', description: 'Attribute code' },
                          position: { type: 'number' },
                        },
                        required: ['code', 'position'],
                      },
                    },
                  },
                  required: ['code', 'position', 'custom_attributes'],
                },
              },
            },
            required: ['code', 'labels', 'attribute_groups'],
          },
        },
        {
          name: 'unopim_update_family',
          description: 'Update an existing family with new attributes or labels',
          inputSchema: {
            type: 'object',
            properties: {
              code: { type: 'string', description: 'Family code to update' },
              add_attributes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    group_code: { type: 'string' },
                    attribute_code: { type: 'string' },
                    position: { type: 'number' },
                  },
                },
              },
              remove_attributes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    attribute_code: { type: 'string' },
                  },
                },
              },
              update_labels: { type: 'object' },
            },
            required: ['code'],
          },
        },

        // Category Tools
        {
          name: 'unopim_get_categories',
          description: 'Fetch category tree with optional parent filtering',
          inputSchema: {
            type: 'object',
            properties: {
              parent_code: { type: 'string', description: 'Filter by parent category code' },
              limit: { type: 'number', default: 100 },
              page: { type: 'number', default: 1 },
            },
          },
        },
        {
          name: 'unopim_create_category',
          description: 'Create a new category with optional parent',
          inputSchema: {
            type: 'object',
            properties: {
              code: { type: 'string', description: 'Unique category code (snake_case)' },
              parent: { type: 'string', description: 'Parent category code' },
              labels: { type: 'object', description: 'Labels for each locale' },
              additional_data: {
                type: 'object',
                properties: {
                  common: { type: 'object' },
                  locale_specific: { type: 'object' },
                },
              },
            },
            required: ['code', 'labels'],
          },
        },

        // Product Tools
        {
          name: 'unopim_create_product',
          description: 'Create a simple product',
          inputSchema: {
            type: 'object',
            properties: {
              sku: { type: 'string', description: 'Unique product SKU' },
              family: { type: 'string', description: 'Product family code' },
              values: {
                type: 'object',
                description: 'Product attribute values',
                properties: {
                  common: { type: 'object', description: 'Non-localized values' },
                  categories: { type: 'array', items: { type: 'string' } },
                  locale_specific: { type: 'object' },
                  channel_specific: { type: 'object' },
                  channel_locale_specific: { type: 'object' },
                  associations: { type: 'object' },
                },
              },
            },
            required: ['sku', 'family', 'values'],
          },
        },
        {
          name: 'unopim_create_configurable_product',
          description: 'Create a configurable product with variants',
          inputSchema: {
            type: 'object',
            properties: {
              sku: { type: 'string', description: 'Parent product SKU' },
              family: { type: 'string', description: 'Product family code' },
              super_attributes: { type: 'array', items: { type: 'string' }, description: 'Attributes that define variants (must be is_configurable)' },
              values: { type: 'object', description: 'Parent product values' },
              variants: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    sku: { type: 'string' },
                    attributes: { type: 'object', description: 'Variant-specific attribute values' },
                    values: { type: 'object' },
                  },
                },
              },
            },
            required: ['sku', 'family', 'super_attributes', 'values'],
          },
        },
        {
          name: 'unopim_bulk_create_products',
          description: 'Batch create multiple products',
          inputSchema: {
            type: 'object',
            properties: {
              products: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    sku: { type: 'string' },
                    family: { type: 'string' },
                    values: { type: 'object' },
                  },
                },
              },
              on_error: { type: 'string', enum: ['stop', 'continue'], default: 'continue' },
              validate_only: { type: 'boolean', default: false },
            },
            required: ['products'],
          },
        },
        {
          name: 'unopim_get_products',
          description: 'List products with optional filtering by SKU, family, or type',
          inputSchema: {
            type: 'object',
            properties: {
              filter_sku: { type: 'string', description: 'Filter by SKU (partial match)' },
              filter_family: { type: 'string', description: 'Filter by family code' },
              filter_type: { type: 'string', enum: ['simple', 'configurable'], description: 'Filter by product type' },
              limit: { type: 'number', default: 100 },
              page: { type: 'number', default: 1 },
            },
          },
        },
        {
          name: 'unopim_get_product',
          description: 'Get a single product by SKU. Returns found=false if product does not exist.',
          inputSchema: {
            type: 'object',
            properties: {
              sku: { type: 'string', description: 'The product SKU' },
            },
            required: ['sku'],
          },
        },
        {
          name: 'unopim_update_product',
          description: 'Update an existing product by SKU',
          inputSchema: {
            type: 'object',
            properties: {
              sku: { type: 'string', description: 'The product SKU to update' },
              values: { type: 'object', description: 'The product values to update' },
            },
            required: ['sku', 'values'],
          },
        },
        {
          name: 'unopim_upsert_product',
          description: 'Create or update a product. If SKU exists, updates it; otherwise creates new product.',
          inputSchema: {
            type: 'object',
            properties: {
              sku: { type: 'string', description: 'The product SKU' },
              family: { type: 'string', description: 'The family code (required for creation)' },
              values: { type: 'object', description: 'The product values' },
            },
            required: ['sku', 'family', 'values'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          // Schema Tools
          case 'unopim_get_schema': {
            const input = GetSchemaInputSchema.parse(args);
            const result = await getSchema(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }

          case 'unopim_get_attributes': {
            const input = GetAttributesInputSchema.parse(args);
            const result = await getAttributes(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }

          case 'unopim_get_families': {
            const input = GetFamiliesInputSchema.parse(args);
            const result = await getFamilies(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }

          // Attribute Tools
          case 'unopim_create_attribute': {
            const input = CreateAttributeInputSchema.parse(args);
            const result = await createAttribute(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }

          case 'unopim_create_attribute_options': {
            const input = CreateAttributeOptionsInputSchema.parse(args);
            const result = await createAttributeOptions(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }

          case 'unopim_get_attribute_options': {
            const input = GetAttributeOptionsInputSchema.parse(args);
            const result = await getAttributeOptions(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }

          // Attribute Group Tools
          case 'unopim_create_attribute_group': {
            const input = CreateAttributeGroupInputSchema.parse(args);
            const result = await createAttributeGroup(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }

          // Family Tools
          case 'unopim_create_family': {
            const input = CreateFamilyInputSchema.parse(args);
            const result = await createFamily(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }

          case 'unopim_update_family': {
            const input = UpdateFamilyInputSchema.parse(args);
            const result = await updateFamily(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }

          // Category Tools
          case 'unopim_get_categories': {
            const input = GetCategoriesInputSchema.parse(args);
            const result = await getCategories(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }

          case 'unopim_create_category': {
            const input = CreateCategoryInputSchema.parse(args);
            const result = await createCategory(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }

          // Product Tools
          case 'unopim_create_product': {
            const input = CreateProductInputSchema.parse(args);
            const result = await createProduct(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }

          case 'unopim_create_configurable_product': {
            const input = CreateConfigurableProductInputSchema.parse(args);
            const result = await createConfigurableProduct(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }

          case 'unopim_bulk_create_products': {
            const input = BulkCreateProductsInputSchema.parse(args);
            const result = await bulkCreateProducts(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }

          case 'unopim_get_products': {
            const input = GetProductsInputSchema.parse(args);
            const result = await getProducts(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }

          case 'unopim_get_product': {
            const input = GetProductInputSchema.parse(args);
            const result = await getProduct(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }

          case 'unopim_update_product': {
            const input = UpdateProductInputSchema.parse(args);
            const result = await updateProduct(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }

          case 'unopim_upsert_product': {
            const input = UpsertProductInputSchema.parse(args);
            const result = await upsertProduct(this.client, input);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }

        // Handle validation errors
        if (error instanceof Error && error.name === 'ZodError') {
          throw new McpError(ErrorCode.InvalidParams, `Validation error: ${error.message}`);
        }

        // Handle other errors
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('UnoPim MCP Server running on stdio');
  }
}

// ============================================================================
// Start Server
// ============================================================================

const server = new UnoPimMcpServer();
server.run().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
