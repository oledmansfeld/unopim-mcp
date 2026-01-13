# UnoPim MCP Server - Available Tools Reference

Complete reference for all 24 tools available in the UnoPim MCP Server.

## Table of Contents
1. [Schema & Discovery Tools](#schema--discovery-tools)
2. [Attribute Management Tools](#attribute-management-tools)
3. [Family Management Tools](#family-management-tools)
4. [Category Management Tools](#category-management-tools)
5. [Product Management Tools](#product-management-tools)
6. [Media Upload Tools](#media-upload-tools)

---

## Schema & Discovery Tools

### 1. `unopim_get_schema`

Get complete data model including attributes, families, categories, channels, and locales.

**Use Case:** Understanding existing PIM structure before importing data

**Input:** None required

**Example:**
```json
{}
```

**Response:**
```json
{
  "attributes": [...],
  "families": [...],
  "categories": [...],
  "channels": [...],
  "locales": [...]
}
```

---

### 2. `unopim_get_attributes`

List all attributes with optional filtering.

**Input Parameters:**
- `filter_type` (optional): Filter by attribute type (text, select, image, etc.)

**Example:**
```json
{
  "filter_type": "image"
}
```

---

### 3. `unopim_get_families`

List all product families.

**Input:** None required

**Example:**
```json
{}
```

---

### 4. `unopim_get_family_schema`

Get detailed schema for a specific family including all attributes and their scoping.

**Input Parameters:**
- `family_code` (required): The family code

**Example:**
```json
{
  "family_code": "coffee_machines"
}
```

**Response Includes:**
- All attributes in family
- Required vs optional attributes
- Attribute scoping (common/locale_specific/channel_specific/channel_locale_specific)
- Attribute types and validation rules

---

## Attribute Management Tools

### 5. `unopim_create_attribute`

Create a new attribute.

**Input Parameters:**
- `code` (required): Unique attribute code (snake_case, alphanumeric + underscore)
- `type` (required): Attribute type
- `labels` (required): Object with locale keys (e.g., `{"en_US": "Color", "da_DK": "Farve"}`)
- `is_required` (optional): Default false
- `is_unique` (optional): Default false
- `is_configurable` (optional): For variant attributes, default false
- `value_per_locale` (optional): Default false
- `value_per_channel` (optional): Default false
- `validation` (optional): email, url, regexp, or null
- `regex_pattern` (optional): Pattern if validation is regexp

**Attribute Types:**
- `text` - Short text (255 chars)
- `textarea` - Long text
- `boolean` - True/false
- `date` - Date picker
- `datetime` - Date and time picker
- `number` - Integer
- `decimal` - Decimal number
- `price` - Price with currency
- `select` - Single choice dropdown
- `multiselect` - Multiple choice
- `image` - Image upload
- `file` - File upload

**Example:**
```json
{
  "code": "brand",
  "type": "text",
  "labels": {
    "en_US": "Brand",
    "da_DK": "Mærke"
  },
  "is_required": false,
  "value_per_locale": false,
  "value_per_channel": false
}
```

---

### 6. `unopim_create_attribute_options`

Create options for select or multiselect attributes.

**Input Parameters:**
- `attribute_code` (required): The attribute code
- `options` (required): Array of option objects

**Example:**
```json
{
  "attribute_code": "color",
  "options": [
    {
      "code": "red",
      "labels": {
        "en_US": "Red",
        "da_DK": "Rød"
      },
      "sort_order": 1
    },
    {
      "code": "blue",
      "labels": {
        "en_US": "Blue",
        "da_DK": "Blå"
      },
      "sort_order": 2
    }
  ]
}
```

**⚠️ Important:** Option codes are case-sensitive!

---

### 7. `unopim_get_attribute_options`

Get all options for a select/multiselect attribute.

**Input Parameters:**
- `attribute_code` (required): The attribute code

**Example:**
```json
{
  "attribute_code": "color"
}
```

---

### 8. `unopim_get_attribute_groups`

List all attribute groups.

**Input:** None required

---

### 9. `unopim_create_attribute_group`

Create a logical grouping of attributes.

**Input Parameters:**
- `code` (required): Unique group code
- `labels` (required): Localized labels
- `sort_order` (optional): Display order

**Example:**
```json
{
  "code": "technical_specs",
  "labels": {
    "en_US": "Technical Specifications",
    "da_DK": "Tekniske Specifikationer"
  },
  "sort_order": 1
}
```

---

## Family Management Tools

### 10. `unopim_create_family`

Create a product family with linked attributes.

**Input Parameters:**
- `code` (required): Unique family code
- `labels` (required): Localized labels
- `attribute_codes` (required): Array of attribute codes to include

**Example:**
```json
{
  "code": "coffee_machines",
  "labels": {
    "en_US": "Coffee Machines",
    "da_DK": "Kaffemaskiner"
  },
  "attribute_codes": ["sku", "name", "description", "price", "image", "brand", "water_capacity"]
}
```

**Note:** Always include base attributes: sku, name, description, price

---

### 11. `unopim_update_family`

Update existing family by adding new attributes.

**Input Parameters:**
- `code` (required): Family code
- `attribute_codes` (required): Array of attribute codes to add

**Example:**
```json
{
  "code": "coffee_machines",
  "attribute_codes": ["warranty_period", "power_consumption"]
}
```

---

## Category Management Tools

### 12. `unopim_get_categories`

Fetch complete category tree.

**Input:** None required

**Response:** Hierarchical category structure

---

### 13. `unopim_create_category`

Create a new category.

**Input Parameters:**
- `code` (required): Unique category code
- `labels` (required): Localized category names
- `parent_code` (optional): Parent category code for hierarchy

**Example:**
```json
{
  "code": "espresso_machines",
  "labels": {
    "en_US": "Espresso Machines",
    "da_DK": "Espressomaskiner"
  },
  "parent_code": "coffee_machines"
}
```

---

## Product Management Tools

### 14. `unopim_get_products`

List products with filtering and pagination.

**Input Parameters:**
- `filter_sku` (optional): Filter by SKU (partial match)
- `filter_family` (optional): Filter by family code
- `filter_type` (optional): simple or configurable
- `limit` (optional): Default 100
- `page` (optional): Default 1

**Example:**
```json
{
  "filter_family": "coffee_machines",
  "limit": 50,
  "page": 1
}
```

---

### 15. `unopim_get_product`

Get single product by SKU.

**Input Parameters:**
- `sku` (required): Product SKU

**Example:**
```json
{
  "sku": "TE806201RW-PB"
}
```

---

### 16. `unopim_create_product`

Create a simple product.

**Input Parameters:**
- `sku` (required): Unique product SKU
- `family` (required): Family code
- `values` (required): Product values object

**Values Structure:**
```json
{
  "sku": "PROD-001",
  "family": "coffee_machines",
  "values": {
    "common": {
      "sku": "PROD-001",
      "price": 2999
    },
    "channel_locale_specific": {
      "default": {
        "da_DK": {
          "name": "Siemens EQ8 Piano Black",
          "description": "<p>Premium espressomaskine</p>"
        }
      }
    },
    "categories": ["coffee_machines", "espresso_machines"]
  }
}
```

**⚠️ Critical Notes:**
- `name` must be in `channel_locale_specific` (not common!)
- `categories` is at top level of `values`
- Attribute values must match their scope (common/locale_specific/channel_specific/channel_locale_specific)

---

### 17. `unopim_update_product`

Update existing product.

**Input Parameters:**
- `sku` (required): Product SKU
- `values` (required): Values to update

**Example:**
```json
{
  "sku": "PROD-001",
  "values": {
    "common": {
      "price": 3299
    }
  }
}
```

---

### 18. `unopim_upsert_product`

Create or update product (checks if SKU exists).

**Input Parameters:**
- `sku` (required): Product SKU
- `family` (required): Family code
- `values` (required): Product values

**Use Case:** Safe import when unsure if product exists

---

### 19. `unopim_smart_create_product`

Create product with automatic validation against family schema.

**Input Parameters:**
- `sku` (required): Product SKU
- `family` (required): Family code
- `product_data` (required): Flat object of attribute values
- `locale` (optional): Default locale
- `channel` (optional): Default channel

**Example:**
```json
{
  "sku": "PROD-001",
  "family": "coffee_machines",
  "product_data": {
    "name": "Siemens EQ8",
    "description": "Premium machine",
    "price": 2999,
    "brand": "Siemens",
    "water_capacity": 2.3
  },
  "locale": "da_DK",
  "channel": "default"
}
```

**Benefits:**
- Automatic scope detection (no need to know value_per_locale/channel settings)
- Validates required attributes
- Warns about misplaced attributes
- Returns detailed errors with suggestions

---

### 20. `unopim_bulk_create_products`

Batch create multiple products.

**Input Parameters:**
- `products` (required): Array of product objects
- `on_error` (optional): "stop" or "continue" (default: continue)
- `validate_only` (optional): Test without creating (default: false)

**Example:**
```json
{
  "products": [
    {
      "sku": "PROD-001",
      "family": "coffee_machines",
      "values": {...}
    },
    {
      "sku": "PROD-002",
      "family": "coffee_machines",
      "values": {...}
    }
  ],
  "on_error": "continue"
}
```

**Response:**
```json
{
  "total": 2,
  "successful": 2,
  "failed": 0,
  "errors": []
}
```

---

### 21. `unopim_create_configurable_product`

Create configurable product (parent) with variants.

**Input Parameters:**
- `sku` (required): Parent product SKU
- `family` (required): Family code
- `super_attributes` (required): Array of variant attributes (e.g., ["color", "size"])
- `values` (required): Parent product values

**Example:**
```json
{
  "sku": "TSHIRT-CONF-001",
  "family": "clothing",
  "super_attributes": ["color", "size"],
  "values": {
    "common": { "sku": "TSHIRT-CONF-001" },
    "channel_locale_specific": {
      "default": {
        "en_US": { "name": "Classic T-Shirt" }
      }
    },
    "categories": ["clothing", "tshirts"]
  }
}
```

**⚠️ Important:**
- Super attributes must have `is_configurable: true`
- Super attributes must be select type
- Variants created separately with `unopim_add_variant`

---

### 22. `unopim_add_variant`

Add variant to configurable product.

**Input Parameters:**
- `parent_sku` (required): Parent product SKU
- `sku` (required): Variant SKU
- `family` (required): Family code (same as parent)
- `values` (required): Variant values
- `variant_attributes` (required): Super attribute values

**Example:**
```json
{
  "parent_sku": "TSHIRT-CONF-001",
  "sku": "TSHIRT-RED-M",
  "family": "clothing",
  "values": {
    "common": {
      "sku": "TSHIRT-RED-M",
      "color": "Red",
      "size": "M"
    },
    "channel_locale_specific": {
      "default": {
        "en_US": { "name": "Classic T-Shirt Red M" }
      }
    }
  },
  "variant_attributes": {
    "color": "Red",
    "size": "M"
  }
}
```

---

### 23. `unopim_update_configurable_product`

Update configurable product.

**Input Parameters:**
- `sku` (required): Parent SKU
- `values` (required): Values to update

---

## Media Upload Tools ⭐ AUTOMATIC LINKING

### 24. `unopim_upload_product_media`

Upload image/file to product AND automatically link it.

**Complete Workflow:**
1. ✅ Upload file to UnoPim storage
2. ✅ Fetch attribute metadata (value_per_locale, value_per_channel)
3. ✅ Fetch current product
4. ✅ Update product with filePath in correct scope
5. ✅ Return success - **image immediately visible in UI**

**Input Parameters:**
- `sku` (required): Product SKU
- `attribute` (required): Attribute code (e.g., "image")
- `file_url` (optional): URL to fetch file from
- `file_base64` (optional): Base64-encoded file content
- `filename` (optional): Filename (required for base64)

**Example - Upload from URL:**
```json
{
  "sku": "TE806201RW-PB",
  "attribute": "image",
  "file_url": "https://example.com/siemens-eq8.jpg"
}
```

**Example - Upload from Base64:**
```json
{
  "sku": "TE806201RW-PB",
  "attribute": "image",
  "file_base64": "iVBORw0KGgo...",
  "filename": "siemens-eq8.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Media uploaded and linked to product 'TE806201RW-PB' attribute 'image'",
  "filePath": "product/35/image/siemens-eq8.jpg"
}
```

**✅ What Happens Automatically:**
- Determines correct value scope based on attribute settings
- Places filePath in: `common`, `locale_specific`, `channel_specific`, or `channel_locale_specific`
- Updates product with PATCH request
- **No manual product update needed!**

---

### 25. `unopim_upload_category_media`

Upload image/file to category AND automatically link it.

**Input Parameters:**
- `code` (required): Category code
- `category_field` (required): Category field name
- `file_url` (optional): URL to fetch file from
- `file_base64` (optional): Base64-encoded file content
- `filename` (optional): Filename

**Example:**
```json
{
  "code": "coffee_machines",
  "category_field": "image",
  "file_url": "https://example.com/category-coffee.jpg"
}
```

---

## Error Handling

All tools return consistent error format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Required attribute 'name' is missing",
    "details": {...},
    "retry_possible": false
  }
}
```

### Error Codes

**Retryable Errors:**
- `AUTH_FAILED` - Token expired or invalid
- `TOKEN_EXPIRED` - OAuth token expired
- `RATE_LIMITED` - Too many requests
- `SERVER_ERROR` - UnoPim server error (5xx)
- `NETWORK_ERROR` - Network connection issue

**Non-Retryable Errors:**
- `NOT_FOUND` - Resource doesn't exist
- `VALIDATION_ERROR` - Invalid input data
- `DUPLICATE_CODE` - Code already exists
- `DEPENDENCY_MISSING` - Referenced resource doesn't exist (e.g., family not found)

---

## Tips & Best Practices

### 1. Always Get Schema First
```
unopim_get_schema() → understand structure → create resources
```

### 2. Follow Dependency Order
```
Attributes → Families → Categories → Products → Media
```

### 3. Use Smart Create for Easy Product Import
```
unopim_smart_create_product() // Auto-detects scopes, validates against family
```

### 4. Bulk Operations for Performance
```
unopim_bulk_create_products() // Faster than individual creates
```

### 5. Media Upload is One-Step
```
unopim_upload_product_media() // Upload + link automatically
```

---

**Last Updated**: 2026-01-13
**Tool Count**: 24
**Categories**: 6
