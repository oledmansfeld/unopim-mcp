# UnoPim MCP Server - Usage Examples

Real-world examples of using the UnoPim MCP Server through Claude Desktop.

## Table of Contents
1. [Customer Onboarding](#customer-onboarding)
2. [Product Import](#product-import)
3. [Image Upload](#image-upload)
4. [Configurable Products](#configurable-products)
5. [Bulk Operations](#bulk-operations)
6. [Data Model Evolution](#data-model-evolution)

---

## Customer Onboarding

### Scenario: New Customer with Coffee Machine Catalog

**User Request:**
> "I have a new customer selling coffee machines. They sent me this product data. Can you set up their PIM system?"

**Claude Workflow:**

#### Step 1: Analyze the Data
Claude reads the CSV/JSON and identifies:
- Product attributes needed (brand, model, water_capacity, price, etc.)
- Attribute types (text, number, price)
- Which attributes need localization

#### Step 2: Check Existing Schema
```
Claude: "Let me check your current PIM structure..."
Tool: unopim_get_schema()
```

#### Step 3: Create Missing Attributes
```
Claude: "I'll create the coffee machine attributes..."

Tool: unopim_create_attribute({
  code: "water_capacity",
  type: "decimal",
  labels: {
    "en_US": "Water Capacity (L)",
    "da_DK": "Vandkapacitet (L)"
  }
})

Tool: unopim_create_attribute({
  code: "brewing_temperature",
  type: "number",
  labels: {
    "en_US": "Brewing Temperature (°C)",
    "da_DK": "Bryggetemperatur (°C)"
  }
})
```

#### Step 4: Create Product Family
```
Tool: unopim_create_family({
  code: "coffee_machines",
  labels: {
    "en_US": "Coffee Machines",
    "da_DK": "Kaffemaskiner"
  },
  attribute_codes: [
    "sku", "name", "description", "price", "image",
    "brand", "water_capacity", "brewing_temperature"
  ]
})
```

#### Step 5: Create Categories
```
Tool: unopim_create_category({
  code: "coffee_machines",
  labels: {
    "en_US": "Coffee Machines",
    "da_DK": "Kaffemaskiner"
  }
})

Tool: unopim_create_category({
  code: "espresso_machines",
  labels: {
    "en_US": "Espresso Machines",
    "da_DK": "Espressomaskiner"
  },
  parent_code: "coffee_machines"
})
```

#### Step 6: Import Products
```
Tool: unopim_bulk_create_products({
  products: [
    {
      sku: "TE806201RW-PB",
      family: "coffee_machines",
      values: {
        common: {
          sku: "TE806201RW-PB",
          brand: "Siemens",
          water_capacity: 2.3,
          brewing_temperature: 93,
          price: 8999
        },
        channel_locale_specific: {
          default: {
            da_DK: {
              name: "Siemens EQ8 Piano Black",
              description: "<p>Premium espressomaskine med OneTouch funktion</p>"
            }
          }
        },
        categories: ["coffee_machines", "espresso_machines"]
      }
    },
    // ... more products
  ],
  on_error: "continue"
})
```

**Result:** Complete PIM setup in 5 minutes!

---

## Product Import

### Scenario: Import 500 Products from CSV

**CSV Format:**
```csv
SKU,Name,Description,Price,Brand,WaterCapacity,Category
TE806201RW-PB,Siemens EQ8 Piano Black,Premium espresso machine,8999,Siemens,2.3,espresso_machines
TE717209RW,Siemens EQ7,Automatic coffee maker,6999,Siemens,1.7,coffee_machines
...
```

**User Request:**
> "Import these 500 products into UnoPim. The family is already set up."

**Claude Workflow:**

#### Step 1: Validate Family Schema
```
Tool: unopim_get_family_schema({
  family_code: "coffee_machines"
})
```

Claude checks:
- ✅ All CSV columns map to existing attributes
- ✅ Required attributes are present
- ✅ Data types match

#### Step 2: Transform Data
Claude converts CSV to UnoPim format, handling:
- Attribute scoping (common vs locale_specific)
- Price formatting
- Category arrays
- HTML encoding for descriptions

#### Step 3: Bulk Import
```
Tool: unopim_bulk_create_products({
  products: [...], // Transformed from CSV
  on_error: "continue"
})
```

#### Step 4: Report Results
```
Claude: "Import completed!
✅ 487 products created successfully
❌ 13 products failed (duplicate SKUs)

Failed products:
- TE123456: SKU already exists
- TE234567: Missing required attribute 'name'
..."
```

**Pro Tip:** Use `validate_only: true` first to test without creating!

---

## Image Upload

### Scenario: Upload Product Images

**User Request:**
> "Add this image to the Siemens EQ8 Piano Black: https://example.com/eq8-black.jpg"

**Claude Workflow:**

#### Simple Upload
```
Claude: "I'll upload the image to product TE806201RW-PB..."

Tool: unopim_upload_product_media({
  sku: "TE806201RW-PB",
  attribute: "image",
  file_url: "https://example.com/eq8-black.jpg"
})

Claude: "✅ Image uploaded and visible on product!"
```

**What Happened Automatically:**
1. File downloaded from URL
2. Uploaded to UnoPim storage at `product/35/image/eq8-black.jpg`
3. Attribute metadata fetched (image is `common` scope)
4. Product updated: `values.common.image = "product/35/image/eq8-black.jpg"`
5. Image now visible in UnoPim UI

### Batch Upload from URLs

**User Request:**
> "Here's a CSV with SKUs and image URLs. Upload all images."

```csv
SKU,ImageURL
TE806201RW-PB,https://cdn.example.com/siemens-eq8.jpg
TE717209RW,https://cdn.example.com/siemens-eq7.jpg
...
```

**Claude Workflow:**
```
Claude: "I'll upload all 50 images..."

For each row:
  Tool: unopim_upload_product_media({
    sku: row.SKU,
    attribute: "image",
    file_url: row.ImageURL
  })

Claude: "✅ All 50 images uploaded successfully!"
```

---

## Configurable Products

### Scenario: T-Shirt with Color and Size Variants

**User Request:**
> "Create a T-shirt product with variants: Small/Medium/Large in Black/White/Navy"

**Claude Workflow:**

#### Step 1: Check Attributes Exist
```
Tool: unopim_get_attributes()

Claude verifies:
- ✅ "color" attribute exists (type: select, is_configurable: true)
- ✅ "size" attribute exists (type: select, is_configurable: true)
- ✅ Both have options defined
```

#### Step 2: Create Parent Product
```
Tool: unopim_create_configurable_product({
  sku: "TSHIRT-CLASSIC",
  family: "clothing",
  super_attributes: ["color", "size"],
  values: {
    common: {
      sku: "TSHIRT-CLASSIC",
      brand: "MyBrand"
    },
    channel_locale_specific: {
      default: {
        da_DK: {
          name: "Klassisk T-Shirt",
          description: "<p>Blød bomulds t-shirt</p>"
        }
      }
    },
    categories: ["clothing", "tshirts"]
  }
})
```

#### Step 3: Create Variants (9 total)
```
Variants to create:
- Black Small, Black Medium, Black Large
- White Small, White Medium, White Large
- Navy Small, Navy Medium, Navy Large

For each variant:
  Tool: unopim_add_variant({
    parent_sku: "TSHIRT-CLASSIC",
    sku: "TSHIRT-BLACK-S",
    family: "clothing",
    values: {
      common: {
        sku: "TSHIRT-BLACK-S",
        color: "Black",
        size: "S",
        price: 199
      },
      channel_locale_specific: {
        default: {
          da_DK: {
            name: "Klassisk T-Shirt Sort S"
          }
        }
      }
    },
    variant_attributes: {
      color: "Black",
      size: "S"
    }
  })
```

#### Step 4: Upload Variant Images
```
Claude: "Now I'll upload images for each color variant..."

Tool: unopim_upload_product_media({
  sku: "TSHIRT-BLACK-S",
  attribute: "image",
  file_url: "https://example.com/tshirt-black.jpg"
})

// Repeat for other colors
```

**Result:** Configurable product with 9 variants, each with proper image!

---

## Bulk Operations

### Scenario: Update Prices for Entire Category

**User Request:**
> "Increase all coffee machine prices by 10%"

**Claude Workflow:**

#### Step 1: Get Products
```
Tool: unopim_get_products({
  filter_family: "coffee_machines",
  limit: 1000
})
```

#### Step 2: Calculate New Prices
```
Claude processes each product:
- Current price: 8999 DKK
- New price: 9899 DKK (8999 * 1.10)
```

#### Step 3: Bulk Update
```
For each product:
  Tool: unopim_update_product({
    sku: product.sku,
    values: {
      common: {
        price: newPrice
      }
    }
  })

Claude: "✅ Updated 147 products
- TE806201RW-PB: 8999 → 9899 DKK
- TE717209RW: 6999 → 7699 DKK
..."
```

---

## Data Model Evolution

### Scenario: Add New Attribute to Existing Products

**User Request:**
> "We now need to track warranty periods for all coffee machines. Add this as a new attribute and update all products."

**Claude Workflow:**

#### Step 1: Create Attribute
```
Tool: unopim_create_attribute({
  code: "warranty_period",
  type: "number",
  labels: {
    "en_US": "Warranty (months)",
    "da_DK": "Garanti (måneder)"
  },
  is_required: false,
  value_per_locale: false,
  value_per_channel: false
})
```

#### Step 2: Update Family
```
Tool: unopim_update_family({
  code: "coffee_machines",
  attribute_codes: ["warranty_period"]
})
```

#### Step 3: Update Products
```
Claude: "I'll add 24-month warranty to all premium models..."

Tool: unopim_bulk_create_products({
  products: [
    {
      sku: "TE806201RW-PB",
      family: "coffee_machines",
      values: {
        common: {
          warranty_period: 24
        }
      }
    },
    // ... more products
  ]
})
```

**Result:** Data model extended without disrupting existing products!

---

## Complex Workflow: Complete Product Launch

### Scenario: Launch New Product Line

**User Request:**
> "Launch the new Siemens EQ.8 Series with 3 variants (Piano Black, Aluminium, White). Each needs images, technical specs, and category assignments."

**Claude Complete Workflow:**

```
1. ✅ Check schema
   Tool: unopim_get_schema()

2. ✅ Create "eq8_series" category
   Tool: unopim_create_category(...)

3. ✅ Create configurable parent
   Tool: unopim_create_configurable_product({
     sku: "EQ8-SERIES",
     super_attributes: ["color_variant"]
   })

4. ✅ Create 3 variants
   For each: unopim_add_variant(...)

5. ✅ Upload product images
   For each: unopim_upload_product_media(...)

6. ✅ Upload technical spec PDF
   unopim_upload_product_media({
     attribute: "datasheet",
     file_url: "https://example.com/eq8-specs.pdf"
   })

7. ✅ Verify all products
   unopim_get_products({ filter_family: "coffee_machines" })

Claude: "🎉 Product launch complete!
- Created 1 configurable product
- Added 3 variants with images
- Uploaded technical documentation
- Assigned to categories

View products:
- TE806201RW-PB: Siemens EQ8 Piano Black
- TE806201RW-A: Siemens EQ8 Aluminium
- TE806201RW-W: Siemens EQ8 White"
```

---

## Tips for Effective Use

### 1. Be Specific with Requests
❌ "Import products"
✅ "Import products from this CSV into the coffee_machines family"

### 2. Provide Context
✅ "This is a new customer onboarding. Family doesn't exist yet."
✅ "These are updates to existing products."

### 3. Share Data Format
✅ Paste CSV headers
✅ Show JSON structure
✅ Share example rows

### 4. Let Claude Handle Complexity
✅ "Create the data model based on this CSV"
✅ "Figure out which attributes need localization"
✅ "Determine the best category structure"

### 5. Review Before Bulk Operations
✅ Ask Claude to show first 3 products before bulk import
✅ Use `validate_only: true` to test without creating

---

**Last Updated**: 2026-01-13
**Example Count**: 15+
**Difficulty**: Beginner to Advanced
