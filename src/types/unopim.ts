/**
 * UnoPim API type definitions
 * Based on UnoPim REST API specification
 */

// ============================================================================
// Attribute Types
// ============================================================================

// UnoPim supported attribute types
// For decimal/number values, use type='text' with validation='decimal'
export type AttributeType =
  | 'text'
  | 'textarea'
  | 'boolean'
  | 'price'
  | 'select'
  | 'multiselect'
  | 'image';

// Validation rules - use 'decimal' or 'number' for numeric text fields
export type ValidationRule = 'email' | 'url' | 'regexp' | 'decimal' | 'number' | null;

export interface AttributeOption {
  code: string;
  sort_order?: number;
  labels: Record<string, string>; // locale -> label
}

export interface Attribute {
  code: string;
  type: AttributeType;
  labels: Record<string, string>; // locale -> label
  is_required: boolean;
  is_unique: boolean;
  is_configurable: boolean; // Used for product variants
  value_per_locale: boolean;
  value_per_channel: boolean;
  validation?: ValidationRule;
  regex_pattern?: string;
  default_value?: string;
  position?: number;
  enable_wysiwyg?: boolean;
  options?: AttributeOption[];
}

// ============================================================================
// Attribute Group Types
// ============================================================================

export interface AttributeGroup {
  code: string;
  labels: Record<string, string>;
  position?: number;
}

// ============================================================================
// Family Types
// ============================================================================

export interface FamilyAttributeAssignment {
  code: string; // attribute code
  position: number;
}

export interface FamilyAttributeGroup {
  code: string; // attribute group code
  position: number;
  custom_attributes: FamilyAttributeAssignment[];
}

export interface Family {
  code: string;
  labels: Record<string, string>;
  attribute_groups: FamilyAttributeGroup[];
}

// ============================================================================
// Category Types
// ============================================================================

export interface Category {
  code: string;
  parent?: string | null;
  labels: Record<string, string>;
  additional_data?: {
    common?: Record<string, unknown>;
    locale_specific?: Record<string, Record<string, unknown>>;
  };
  children?: Category[];
}

// ============================================================================
// Channel & Locale Types
// ============================================================================

export interface Channel {
  code: string;
  name: string;
  description?: string;
  locales: string[];
  currencies: string[];
  default_locale: string;
}

export interface Locale {
  code: string;
  name: string;
  direction?: 'ltr' | 'rtl';
}

export interface Currency {
  code: string;
  name: string;
  symbol?: string;
}

// ============================================================================
// Product Types
// ============================================================================

export interface ProductValues {
  common?: Record<string, unknown>; // Non-localized, non-channelized values
  categories?: string[]; // Category codes

  locale_specific?: Record<string, Record<string, unknown>>; // locale -> attribute -> value
  channel_specific?: Record<string, Record<string, unknown>>; // channel -> attribute -> value
  channel_locale_specific?: Record<string, Record<string, Record<string, unknown>>>; // channel -> locale -> attribute -> value

  associations?: {
    up_sells?: string[];
    cross_sells?: string[];
    related_products?: string[];
  };
}

export interface Product {
  sku: string;
  family: string;
  type: 'simple' | 'configurable';
  parent?: string; // Parent SKU for variants
  values: ProductValues;
  created_at?: string;
  updated_at?: string;
}

export interface ConfigurableProduct extends Product {
  type: 'configurable';
  super_attributes: string[]; // Attribute codes used for variants
  variants?: ProductVariant[];
}

export interface ProductVariant {
  sku: string;
  attributes: Record<string, string>; // Variant-specific attribute values
  values?: ProductValues; // Optional variant-specific values
}

// ============================================================================
// Schema Types
// ============================================================================

export interface Schema {
  attributes: Attribute[];
  attribute_groups: AttributeGroup[];
  families: Family[];
  categories: Category[];
  channels?: Channel[];
  locales?: Locale[];
  currencies?: Currency[];
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  data?: T;
  message?: string;
}

export interface ListResponse<T> {
  data: T[];
  meta?: {
    current_page: number;
    from: number;
    last_page: number;
    per_page: number;
    to: number;
    total: number;
  };
  links?: {
    first?: string;
    last?: string;
    prev?: string;
    next?: string;
  };
}

export interface BulkCreateResult {
  success: boolean;
  created_count: number;
  failed_count: number;
  results: Array<{
    sku: string;
    success: boolean;
    error?: string;
  }>;
}
