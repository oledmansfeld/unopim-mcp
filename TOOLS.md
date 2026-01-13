# UnoPim MCP Tools Reference 🛠️

Complete reference for all 24 MCP tools available in the UnoPim MCP Server.

---

## 📑 Table of Contents

- [Schema & Discovery](#schema--discovery)
- [Attribute Management](#attribute-management)
- [Family Management](#family-management)
- [Category Management](#category-management)
- [Product Management](#product-management)
- [Configurable Products](#configurable-products)
- [Media Upload](#media-upload)

---

## Schema & Discovery

### `unopim_get_schema`

Fetch the complete UnoPim data model including all attributes, families, and their relationships.

**Parameters:** None

**Returns:** Complete schema with attribute types, validation rules, and family structures.

---

### `unopim_get_attributes`

List all attributes with their types and configuration.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `limit` | number | No | Max results (default: 100) |

**Response includes:**
- `code` - Attribute identifier
- `type` - One of: text, textarea, boolean, date, datetime, price, select, multiselect, image, file, number
- `value_per_locale` - 0 or 1
- `value_per_channel` - 0 or 1
- `validation_rules` - Type-specific validation

---

### `unopim_get_families`

List all product families.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `limit` | number | No | Max results (default: 100) |

---

### `unopim_get_family_schema`

Get detailed schema for a specific family including all attributes and their scoping.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | string | Yes | Family code (e.g., "default") |

**Returns:**
```json
{
  "code": "default",
  "attributes": [
    {
      "code": "sku",
      "type": "text",
      "value_per_locale": 0,
      "value_per_channel": 0,
      "is_required": true,
      "scope": "common"
    },
    {
      "code": "name",
      "type": "text",
      "value_per_locale": 1,
      "value_per_channel": 1,
      "is_required": true,
      "scope": "channel_locale_specific"
    }
  ]
}
```

---

## Attribute Management

### `unopim_create_attribute`

Create a new attribute.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | string | Yes | Unique identifier |
| `type` | string | Yes | Attribute type |
| `labels` | object | No | Display labels `{ "en_US": "Name" }` |
| `value_per_locale` | boolean | No | Translatable (default: false) |
| `value_per_channel` | boolean | No | Channel-specific (default: false) |
| `is_required` | boolean | No | Required field (default: false) |
| `is_unique` | boolean | No | Must be unique (default: false) |
| `validation_rules` | object | No | Type-specific validation |

**Attribute Types:**
- `text` - Single line text
- `textarea` - Multi-line text
- `boolean` - True/false
- `number` - Numeric value (supports decimals)
- `price` - Price with currency
- `date` - Date only
- `datetime` - Date and time
- `select` - Single select dropdown
- `multiselect` - Multiple select
- `image` - Image file
- `file` - Generic file

**Validation Rules by Type:**
```json
// text
{ "validation_rules": { "max_length": 255 } }

// number
{ "validation_rules": { "decimal_places": 2, "min": 0, "max": 9999 } }

// price
{ "validation_rules": { "decimal_places": 2 } }
```

---

### `unopim_create_attribute_options`

Create options for select/multiselect attributes.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `attribute_code` | string | Yes | Parent attribute code |
| `options` | array | Yes | Array of option objects |

**Options Format:**
```json
{
  "attribute_code": "color",
  "options": [
    { "code": "red", "labels": { "en_US": "Red" } },
    { "code": "blue", "labels": { "en_US": "Blue" } },
    { "code": "green", "labels": { "en_US": "Green" } }
  ]
}
```

---

### `unopim_get_attribute_options`

Get all options for a select attribute.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `attribute_code` | string | Yes | Attribute code |

**Returns:** Array of options with codes and labels.

---

### `unopim_get_attribute_groups`

List all attribute groups for organizing attributes.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `limit` | number | No | Max results (default: 100) |

---

### `unopim_create_attribute_group`

Create an attribute group.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | string | Yes | Unique identifier |
| `labels` | object | No | Display labels |
| `position` | number | No | Sort order |

---

## Family Management

### `unopim_create_family`

Create a product family.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | string | Yes | Unique identifier |
| `labels` | object | No | Display labels |
| `position` | number | Yes | Sort order (REQUIRED!) |
| `custom_attributes` | array | Yes | Attribute group associations (REQUIRED!) |

**Example:**
```json
{
  "code": "tshirts",
  "labels": { "en_US": "T-Shirts" },
  "position": 1,
  "custom_attributes": [
    {
      "code": "general",
      "position": 1,
      "custom_attributes": ["sku", "name", "description"]
    },
    {
      "code": "pricing",
      "position": 2,
      "custom_attributes": ["price"]
    }
  ]
}
```

---

### `unopim_update_family`

Update an existing family.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | string | Yes | Family code to update |
| `labels` | object | No | New labels |
| `position` | number | No | New position |
| `custom_attributes` | array | No | Updated attribute groups |

---

## Category Management

### `unopim_get_categories`

Fetch category tree.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `parent` | string | No | Parent code for subtree |
| `limit` | number | No | Max results (default: 100) |

---

### `unopim_create_category`

Create a category.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | string | Yes | Unique identifier |
| `parent` | string | No | Parent category code |
| `labels` | object | No | Display labels |
| `additional_data` | object | No | Custom fields |

---

## Product Management

### `unopim_get_products`

List products with filtering.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `limit` | number | No | Max results (default: 100) |
| `page` | number | No | Page number |
| `filters` | object | No | Filter criteria |

---

### `unopim_get_product`

Get single product by SKU.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sku` | string | Yes | Product SKU |

---

### `unopim_create_product`

Create a simple product.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sku` | string | Yes | Unique SKU |
| `family` | string | Yes | Family code |
| `values` | object | Yes | Attribute values |

**Values Structure:**
```json
{
  "sku": "PROD001",
  "family": "default",
  "values": {
    "common": {
      "sku": "PROD001"
    },
    "channel_locale_specific": {
      "default": {
        "en_US": {
          "name": "Product Name",
          "description": "Product description"
        }
      }
    },
    "categories": ["category_code"],
    "associations": {
      "up_sells": [],
      "cross_sells": [],
      "related_products": []
    }
  }
}
```

---

### `unopim_smart_create_product` ⭐

Intelligently create a product by first fetching the family schema and validating attribute placement.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sku` | string | Yes | Unique SKU |
| `family` | string | Yes | Family code |
| `attributes` | object | Yes | Flat attribute map |
| `categories` | array | No | Category codes |

**Example:**
```json
{
  "sku": "SMART001",
  "family": "default",
  "attributes": {
    "name": "Smart Product",
    "description": "Created with smart tool",
    "price": 29.99
  },
  "categories": ["master"]
}
```

The tool automatically places values in the correct scope (common, locale_specific, etc.) based on the family schema.

---

### `unopim_update_product`

Update an existing product.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sku` | string | Yes | Product SKU |
| `values` | object | Yes | New values |

---

### `unopim_upsert_product`

Create or update a product.

**Parameters:** Same as `unopim_create_product`

---

### `unopim_bulk_create_products`

Create multiple products in batch.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `products` | array | Yes | Array of product objects |

---

## Configurable Products

### `unopim_create_configurable_product`

Create a parent product with variant support.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sku` | string | Yes | Parent SKU |
| `family` | string | Yes | Family code |
| `super_attributes` | array | Yes | Variant axis attributes |
| `values` | object | Yes | Parent product values |
| `variants` | array | No | Initial variants (optional) |

**Example:**
```json
{
  "sku": "tshirt-config",
  "family": "default",
  "super_attributes": ["color", "size"],
  "values": {
    "common": { "sku": "tshirt-config" },
    "channel_locale_specific": {
      "default": {
        "en_US": { "name": "Configurable T-Shirt" }
      }
    },
    "categories": [],
    "associations": { "up_sells": [], "cross_sells": [], "related_products": [] }
  }
}
```

> **Note:** UnoPim's API has a typo: uses `/configrable-products` (missing 'u'). The MCP server handles this automatically.

---

### `unopim_add_variant`

Add a variant to an existing configurable product.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `parent` | string | Yes | Parent product SKU |
| `sku` | string | Yes | Variant SKU |
| `family` | string | Yes | Family code |
| `values` | object | Yes | Variant values |
| `variant_attributes` | object | Yes | Axis attribute values |

**Example:**
```json
{
  "parent": "tshirt-config",
  "family": "default",
  "sku": "tshirt-red-m",
  "values": {
    "common": { "sku": "tshirt-red-m", "color": "Red", "size": "M" },
    "channel_locale_specific": {
      "default": {
        "en_US": { "name": "T-Shirt Red Medium" }
      }
    },
    "categories": []
  },
  "variant_attributes": { "color": "Red", "size": "M" }
}
```

---

### `unopim_update_configurable_product`

Update a configurable product's parent data or add more variants.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sku` | string | Yes | Parent SKU |
| `values` | object | No | Updated parent values |
| `variants` | array | No | Additional variants |

---

## Media Upload

### `unopim_upload_product_media`

Upload an image or file to a product attribute.

**Parameters (via URL):**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sku` | string | Yes | Product SKU |
| `attribute` | string | Yes | Target attribute (e.g., "image") |
| `file_url` | string | Yes* | URL to download file from |

**Parameters (via Base64):**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sku` | string | Yes | Product SKU |
| `attribute` | string | Yes | Target attribute |
| `file_base64` | string | Yes* | Base64-encoded file content |
| `filename` | string | Yes* | Filename with extension |

*Either `file_url` OR (`file_base64` + `filename`) required.

**Example (URL):**
```json
{
  "sku": "PROD001",
  "attribute": "image",
  "file_url": "https://example.com/product-image.jpg"
}
```

**Example (Base64):**
```json
{
  "sku": "PROD001",
  "attribute": "image",
  "file_base64": "iVBORw0KGgoAAAANSUhEUgAAAAUA...",
  "filename": "product.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Product file uploaded successfully.",
  "data": {
    "attribute": "image",
    "sku": "PROD001",
    "filePath": "product/1/image/product.jpg"
  }
}
```

---

### `unopim_upload_category_media`

Upload an image to a category field.

**Parameters (via URL):**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `category_code` | string | Yes | Category code |
| `field` | string | Yes | Target field |
| `file_url` | string | Yes* | URL to download file from |

**Parameters (via Base64):**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `category_code` | string | Yes | Category code |
| `field` | string | Yes | Target field |
| `file_base64` | string | Yes* | Base64-encoded file content |
| `filename` | string | Yes* | Filename with extension |

---

## 📋 Attribute Scope Quick Reference

| `value_per_locale` | `value_per_channel` | Scope | Path |
|--------------------|---------------------|-------|------|
| 0 | 0 | `common` | `values.common.attr` |
| 1 | 0 | `locale_specific` | `values.locale_specific.en_US.attr` |
| 0 | 1 | `channel_specific` | `values.channel_specific.default.attr` |
| 1 | 1 | `channel_locale_specific` | `values.channel_locale_specific.default.en_US.attr` |

---

## 🐛 API Quirks Reference

| Issue | Description | Workaround |
|-------|-------------|------------|
| Configurable endpoint typo | `/configrable-products` missing 'u' | MCP server handles this |
| Options array format | Returns `[...]` not `{ data: [...] }` | MCP server normalizes |
| Position required | Family creation requires position | Always provide position: 1 |
| Case-sensitive options | "Red" ≠ "red" | Match option codes exactly |
| Variants separate API | Can't create variants in parent call | Use `unopim_add_variant` |

---

Made with ❤️ for PIM automation through AI
