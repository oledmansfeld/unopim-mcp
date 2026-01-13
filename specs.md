# UnoPim MCP Server - Teknisk Specifikation

**Version:** 1.0  
**Dato:** 12. januar 2026  
**Forfatter:** PicoPublish  
**Status:** Draft

---

## 1. Formål og Scope

### 1.1 Formål

Udvikle en MCP (Model Context Protocol) server der fungerer som intelligent facade foran UnoPim's REST API. Serveren skal gøre det muligt for Claude at analysere rå produktdata og automatisk oprette den nødvendige datamodel i UnoPim, samt importere produkter.

### 1.2 Primære Use Cases

| # | Use Case | Beskrivelse |
|---|----------|-------------|
| UC1 | Hurtig kundeonboarding | Modtag produktdata (CSV/JSON/Excel) fra ny kunde, lad Claude analysere strukturen og automatisk oprette datamodel i UnoPim |
| UC2 | Datamodel-evolution | Udvid eksisterende datamodel når nye produkttyper eller attributter introduceres |
| UC3 | Produkt-import | Bulk-import af produkter efter datamodel er etableret |

### 1.3 Afgrænsning

**Inkluderet i v1.0:**
- Datamodel-oprettelse (Attributes, Attribute Groups, Families)
- Produkt-oprettelse (Simple og Configurable)
- Kategori-håndtering
- Schema-inspektion

**Ikke inkluderet i v1.0:**
- Media/asset håndtering
- Brugeradministration
- Channel-konfiguration ud over defaults

---

## 2. Arkitektur

### 2.1 Multi-tenant Design

Hver kunde får sin egen MCP-server instans med isoleret konfiguration:

```
┌─────────────────────────────────────────────────────────────┐
│                     Claude Desktop / Claude.ai              │
├─────────────────────────────────────────────────────────────┤
│  claude_desktop_config.json                                 │
│  ┌────────────────────┐  ┌────────────────────┐            │
│  │ unopim-kunde-a     │  │ unopim-kunde-b     │  ...       │
│  │ ENV: url, creds    │  │ ENV: url, creds    │            │
│  └─────────┬──────────┘  └─────────┬──────────┘            │
└────────────┼───────────────────────┼────────────────────────┘
             │                       │
             ▼                       ▼
┌────────────────────┐  ┌────────────────────┐
│ UnoPim Instance A  │  │ UnoPim Instance B  │
│ kunde-a.pim.dk     │  │ kunde-b.pim.dk     │
└────────────────────┘  └────────────────────┘
```

### 2.2 Konfigurationsmodel

Hver instans konfigureres via environment variabler:

| Variabel | Påkrævet | Beskrivelse | Eksempel |
|----------|----------|-------------|----------|
| `UNOPIM_BASE_URL` | Ja | UnoPim API base URL | `https://kunde-a.pim.dk` |
| `UNOPIM_CLIENT_ID` | Ja | OAuth2 Client ID | `1_abc123...` |
| `UNOPIM_CLIENT_SECRET` | Ja | OAuth2 Client Secret | `secret123...` |
| `UNOPIM_USERNAME` | Ja | API bruger | `api-user` |
| `UNOPIM_PASSWORD` | Ja | API password | `********` |
| `UNOPIM_DEFAULT_LOCALE` | Nej | Standard locale | `da_DK` (default: `en_US`) |
| `UNOPIM_DEFAULT_CHANNEL` | Nej | Standard channel | `default` |
| `UNOPIM_DEFAULT_CURRENCY` | Nej | Standard valuta | `DKK` (default: `USD`) |

### 2.3 Claude Desktop Konfiguration

Eksempel på `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "unopim-kunde-a": {
      "command": "node",
      "args": ["/path/to/unopim-mcp/dist/index.js"],
      "env": {
        "UNOPIM_BASE_URL": "https://kunde-a.pim.dk",
        "UNOPIM_CLIENT_ID": "1_abc123",
        "UNOPIM_CLIENT_SECRET": "secret123",
        "UNOPIM_USERNAME": "api-user",
        "UNOPIM_PASSWORD": "securepassword",
        "UNOPIM_DEFAULT_LOCALE": "da_DK",
        "UNOPIM_DEFAULT_CURRENCY": "DKK"
      }
    },
    "unopim-kunde-b": {
      "command": "node",
      "args": ["/path/to/unopim-mcp/dist/index.js"],
      "env": {
        "UNOPIM_BASE_URL": "https://kunde-b.pim.dk",
        "UNOPIM_CLIENT_ID": "2_def456",
        "UNOPIM_CLIENT_SECRET": "secret456",
        "UNOPIM_USERNAME": "api-user",
        "UNOPIM_PASSWORD": "anotherpassword",
        "UNOPIM_DEFAULT_LOCALE": "en_US",
        "UNOPIM_DEFAULT_CURRENCY": "EUR"
      }
    }
  }
}
```

---

## 3. Authentication

### 3.1 OAuth2 Password Grant Flow

UnoPim bruger OAuth2 med password grant:

```
POST /oauth/token
Authorization: Basic base64(client_id:client_secret)
Content-Type: application/json

{
  "username": "api-user",
  "password": "password",
  "grant_type": "password"
}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "def...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### 3.2 Token Management

MCP-serveren skal:

1. **Cache access token** i hukommelsen
2. **Track expiry** og refresh proaktivt (5 min før udløb)
3. **Håndtere refresh** automatisk ved 401 responses
4. **Retry logic** ved netværksfejl (max 3 forsøg med exponential backoff)

---

## 4. MCP Tools Specifikation

### 4.1 Oversigt

| Kategori | Tool | Beskrivelse |
|----------|------|-------------|
| **Schema** | `unopim_get_schema` | Hent komplet datamodel |
| **Schema** | `unopim_get_attributes` | List alle attributter |
| **Schema** | `unopim_get_families` | List alle families |
| **Attributes** | `unopim_create_attribute` | Opret ny attribut |
| **Attributes** | `unopim_create_attribute_options` | Opret options for select-attribut |
| **Groups** | `unopim_create_attribute_group` | Opret attribute group |
| **Families** | `unopim_create_family` | Opret produktfamilie |
| **Families** | `unopim_update_family` | Opdater family med nye attributter |
| **Categories** | `unopim_get_categories` | List kategorier |
| **Categories** | `unopim_create_category` | Opret kategori |
| **Products** | `unopim_create_product` | Opret simpelt produkt |
| **Products** | `unopim_create_configurable_product` | Opret konfigurerbart produkt |
| **Products** | `unopim_bulk_create_products` | Batch-opret produkter |

---

### 4.2 Schema Tools

#### `unopim_get_schema`

Henter komplet overblik over eksisterende datamodel.

**Input Schema:**
```typescript
{
  include_attributes?: boolean;  // default: true
  include_families?: boolean;    // default: true
  include_categories?: boolean;  // default: true
  include_channels?: boolean;    // default: false
  include_locales?: boolean;     // default: false
}
```

**Output:**
```typescript
{
  attributes: Attribute[];
  attribute_groups: AttributeGroup[];
  families: Family[];
  categories: Category[];
  channels?: Channel[];
  locales?: Locale[];
}
```

**Brug:** Claude kalder dette først for at forstå eksisterende setup før nye elementer oprettes.

---

#### `unopim_get_attributes`

Henter alle attributter med detaljer.

**Input Schema:**
```typescript
{
  filter_by_type?: string;       // f.eks. "select", "text", "boolean"
  filter_by_group?: string;      // attribute group code
  limit?: number;                // default: 100
  page?: number;                 // default: 1
}
```

**Output:**
```typescript
{
  attributes: Array<{
    code: string;
    type: string;
    labels: Record<string, string>;
    is_required: boolean;
    is_unique: boolean;
    is_configurable: boolean;
    value_per_locale: boolean;
    value_per_channel: boolean;
    options?: Array<{code: string, labels: Record<string, string>}>;
  }>;
  pagination: {
    current_page: number;
    total_pages: number;
    total_items: number;
  };
}
```

---

### 4.3 Attribute Tools

#### `unopim_create_attribute`

Opretter en ny attribut i UnoPim.

**Input Schema:**
```typescript
{
  code: string;                           // Påkrævet, unik identifier (snake_case)
  type: AttributeType;                    // Påkrævet, se tabel nedenfor
  labels: Record<string, string>;         // Påkrævet, mindst default locale
  
  // Valgfrie felter
  is_required?: boolean;                  // default: false
  is_unique?: boolean;                    // default: false
  is_configurable?: boolean;              // default: false - bruges til variants
  value_per_locale?: boolean;             // default: false
  value_per_channel?: boolean;            // default: false
  validation?: "email" | "url" | "regexp" | null;
  regex_pattern?: string;                 // hvis validation = "regexp"
  default_value?: string;
  position?: number;
  enable_wysiwyg?: boolean;               // kun for textarea
}
```

**Understøttede AttributeType værdier:**

| Type | Beskrivelse | Eksempel |
|------|-------------|----------|
| `text` | Kort tekst | Produktnavn, SKU |
| `textarea` | Lang tekst, evt. med WYSIWYG | Beskrivelse |
| `boolean` | Ja/Nej | Aktiv status |
| `date` | Dato | Udgivelsesdato |
| `datetime` | Dato og tid | Oprettelsestidspunkt |
| `number` | Heltal | Antal på lager |
| `decimal` | Decimaltal | Vægt |
| `price` | Pris (valuta-specifik) | Salgspris |
| `select` | Dropdown (enkeltvalg) | Farve |
| `multiselect` | Multiple choice | Materialer |
| `image` | Billede | Produktbillede |
| `file` | Fil | Datablad PDF |

**Output:**
```typescript
{
  success: boolean;
  attribute: {
    code: string;
    type: string;
    // ... alle felter
  };
  message?: string;
}
```

**Eksempel:**
```json
{
  "code": "product_weight",
  "type": "decimal",
  "labels": {
    "da_DK": "Vægt (kg)",
    "en_US": "Weight (kg)"
  },
  "is_required": false,
  "value_per_channel": false,
  "value_per_locale": false
}
```

---

#### `unopim_create_attribute_options`

Opretter valgmuligheder for select/multiselect attributter.

**Input Schema:**
```typescript
{
  attribute_code: string;          // Påkrævet, skal eksistere
  options: Array<{
    code: string;                  // Unik inden for attributten
    sort_order?: number;
    labels: Record<string, string>;
  }>;
}
```

**Output:**
```typescript
{
  success: boolean;
  created_count: number;
  options: Array<{code: string, labels: Record<string, string>}>;
  errors?: Array<{code: string, error: string}>;
}
```

**Eksempel:**
```json
{
  "attribute_code": "color",
  "options": [
    {
      "code": "black",
      "sort_order": 1,
      "labels": {"da_DK": "Sort", "en_US": "Black"}
    },
    {
      "code": "white",
      "sort_order": 2,
      "labels": {"da_DK": "Hvid", "en_US": "White"}
    }
  ]
}
```

---

### 4.4 Attribute Group Tools

#### `unopim_create_attribute_group`

Opretter en logisk gruppering af attributter.

**Input Schema:**
```typescript
{
  code: string;                    // Påkrævet, unik identifier
  labels: Record<string, string>;  // Påkrævet
  position?: number;
}
```

**Output:**
```typescript
{
  success: boolean;
  attribute_group: {
    code: string;
    labels: Record<string, string>;
  };
}
```

**Eksempel:**
```json
{
  "code": "technical_specs",
  "labels": {
    "da_DK": "Tekniske specifikationer",
    "en_US": "Technical Specifications"
  },
  "position": 3
}
```

---

### 4.5 Family Tools

#### `unopim_create_family`

Opretter en produktfamilie med tilknyttede attributter.

**Input Schema:**
```typescript
{
  code: string;                           // Påkrævet
  labels: Record<string, string>;         // Påkrævet
  attribute_groups: Array<{
    code: string;                         // Eksisterende attribute group
    position: number;
    custom_attributes: Array<{
      code: string;                       // Eksisterende attribut
      position: number;
    }>;
  }>;
}
```

**Output:**
```typescript
{
  success: boolean;
  family: {
    code: string;
    labels: Record<string, string>;
    attribute_groups: Array<{...}>;
  };
}
```

**Eksempel:**
```json
{
  "code": "clothing",
  "labels": {
    "da_DK": "Beklædning",
    "en_US": "Clothing"
  },
  "attribute_groups": [
    {
      "code": "general",
      "position": 1,
      "custom_attributes": [
        {"code": "sku", "position": 1},
        {"code": "name", "position": 2},
        {"code": "description", "position": 3}
      ]
    },
    {
      "code": "technical_specs",
      "position": 2,
      "custom_attributes": [
        {"code": "color", "position": 1},
        {"code": "size", "position": 2},
        {"code": "material", "position": 3}
      ]
    }
  ]
}
```

---

#### `unopim_update_family`

Opdaterer eksisterende family med nye attributter.

**Input Schema:**
```typescript
{
  code: string;                           // Eksisterende family code
  add_attributes?: Array<{
    group_code: string;
    attribute_code: string;
    position?: number;
  }>;
  remove_attributes?: Array<{
    attribute_code: string;
  }>;
  update_labels?: Record<string, string>;
}
```

---

### 4.6 Category Tools

#### `unopim_get_categories`

Henter kategoritræ.

**Input Schema:**
```typescript
{
  parent_code?: string;    // Filtrer børn af specifik kategori
  limit?: number;
  page?: number;
}
```

**Output:**
```typescript
{
  categories: Array<{
    code: string;
    parent: string | null;
    labels: Record<string, string>;
    children?: Category[];
  }>;
}
```

---

#### `unopim_create_category`

Opretter ny kategori.

**Input Schema:**
```typescript
{
  code: string;
  parent?: string;                        // Parent category code
  labels: Record<string, string>;
  additional_data?: {
    common?: Record<string, any>;
    locale_specific?: Record<string, Record<string, any>>;
  };
}
```

---

### 4.7 Product Tools

#### `unopim_create_product`

Opretter et simpelt produkt.

**Input Schema:**
```typescript
{
  sku: string;                            // Påkrævet, unik
  family: string;                         // Påkrævet, family code
  
  values: {
    common?: Record<string, any>;         // Ikke-lokaliserede værdier
    categories?: string[];                // Category codes
    
    locale_specific?: Record<string, Record<string, any>>;
    channel_specific?: Record<string, Record<string, any>>;
    channel_locale_specific?: Record<string, Record<string, Record<string, any>>>;
    
    associations?: {
      up_sells?: string[];
      cross_sells?: string[];
      related_products?: string[];
    };
  };
}
```

**Output:**
```typescript
{
  success: boolean;
  product: {
    sku: string;
    family: string;
    type: "simple";
    created_at: string;
  };
  errors?: Array<{field: string, message: string}>;
}
```

**Eksempel:**
```json
{
  "sku": "TSHIRT-001",
  "family": "clothing",
  "values": {
    "common": {
      "sku": "TSHIRT-001",
      "color": "black",
      "size": "large",
      "status": "true"
    },
    "categories": ["clothing", "mens", "tshirts"],
    "channel_locale_specific": {
      "default": {
        "da_DK": {
          "name": "Klassisk T-Shirt",
          "description": "<p>Blød bomulds t-shirt</p>",
          "price": {"DKK": "299"}
        }
      }
    }
  }
}
```

---

#### `unopim_create_configurable_product`

Opretter konfigurerbart produkt med varianter.

**Input Schema:**
```typescript
{
  sku: string;
  family: string;
  super_attributes: string[];             // Attributter der definerer varianter
  
  values: {
    // Samme struktur som simple product
  };
  
  variants?: Array<{
    sku: string;
    attributes: Record<string, string>;   // Variant-specifikke attributværdier
    values?: {...};                        // Variant-specifikke øvrige værdier
  }>;
}
```

**Eksempel:**
```json
{
  "sku": "TSHIRT-CONFIG",
  "family": "clothing",
  "super_attributes": ["color", "size"],
  "values": {
    "common": {
      "name": "Klassisk T-Shirt",
      "status": "true"
    },
    "categories": ["clothing", "tshirts"]
  },
  "variants": [
    {
      "sku": "TSHIRT-BLACK-S",
      "attributes": {"color": "black", "size": "small"}
    },
    {
      "sku": "TSHIRT-BLACK-M",
      "attributes": {"color": "black", "size": "medium"}
    },
    {
      "sku": "TSHIRT-WHITE-S",
      "attributes": {"color": "white", "size": "small"}
    }
  ]
}
```

---

#### `unopim_bulk_create_products`

Batch-oprettelse af produkter.

**Input Schema:**
```typescript
{
  products: Array<ProductInput>;          // Array af produkt-objekter
  on_error: "stop" | "continue";          // Stop ved fejl eller fortsæt
  validate_only?: boolean;                // Kun validér, opret ikke
}
```

**Output:**
```typescript
{
  success: boolean;
  created_count: number;
  failed_count: number;
  results: Array<{
    sku: string;
    success: boolean;
    error?: string;
  }>;
}
```

---

## 5. Error Handling

### 5.1 Error Response Format

Alle tools returnerer fejl i konsistent format:

```typescript
{
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: any;
    retry_possible: boolean;
  };
}
```

### 5.2 Error Codes

| Code | Beskrivelse | Retry? |
|------|-------------|--------|
| `AUTH_FAILED` | Authentication fejlede | Ja |
| `TOKEN_EXPIRED` | Token udløbet (håndteres automatisk) | Ja |
| `NOT_FOUND` | Resource findes ikke | Nej |
| `VALIDATION_ERROR` | Ugyldig input | Nej |
| `DUPLICATE_CODE` | Code eksisterer allerede | Nej |
| `DEPENDENCY_MISSING` | Afhængig resource mangler | Nej |
| `RATE_LIMITED` | For mange requests | Ja |
| `SERVER_ERROR` | UnoPim server fejl | Ja |
| `NETWORK_ERROR` | Netværksfejl | Ja |

### 5.3 Retry Strategy

For fejl markeret som `retry_possible`:

1. **Attempt 1:** Umiddelbart
2. **Attempt 2:** Efter 1 sekund
3. **Attempt 3:** Efter 3 sekunder
4. **Give up:** Returner fejl til Claude

---

## 6. Typisk Workflow

### 6.1 Kundeonboarding Flow

```
Bruger: "Her er produktdata fra ny kunde [CSV fil]"
    │
    ▼
Claude: Analyserer data, identificerer felter
    │
    ▼
Claude: Kalder unopim_get_schema()
    │ → Forstår eksisterende setup
    ▼
Claude: Kalder unopim_create_attribute() × N
    │ → Opretter manglende attributter
    ▼
Claude: Kalder unopim_create_attribute_options() × N
    │ → Opretter options for select-felter
    ▼
Claude: Kalder unopim_create_attribute_group() × N
    │ → Opretter logiske grupperinger
    ▼
Claude: Kalder unopim_create_family()
    │ → Samler det hele i en family
    ▼
Claude: Kalder unopim_bulk_create_products()
    │ → Importerer produkterne
    ▼
Claude: Rapporterer resultat til bruger
```

### 6.2 Rækkefølge-afhængigheder

Det er kritisk at oprette elementer i korrekt rækkefølge:

```
1. Locales & Channels (typisk pre-konfigureret)
       ↓
2. Attributes
       ↓
3. Attribute Options (for select-typer)
       ↓
4. Attribute Groups
       ↓
5. Families (refererer til groups og attributes)
       ↓
6. Categories
       ↓
7. Products (refererer til family og categories)
```

---

## 7. Teknisk Implementation

### 7.1 Teknologi Stack

| Komponent | Teknologi |
|-----------|-----------|
| Runtime | Node.js 20+ |
| Sprog | TypeScript 5.x |
| MCP SDK | `@modelcontextprotocol/sdk` |
| HTTP Client | `fetch` (native) |
| Validation | `zod` |
| Build | `tsup` eller `esbuild` |

### 7.2 Projektstruktur

```
unopim-mcp/
├── src/
│   ├── index.ts              # Entry point, MCP server setup
│   ├── config.ts             # Environment configuration
│   ├── auth/
│   │   └── oauth.ts          # OAuth2 token management
│   ├── client/
│   │   └── unopim-client.ts  # Base API client
│   ├── tools/
│   │   ├── schema.ts         # Schema inspection tools
│   │   ├── attributes.ts     # Attribute management
│   │   ├── families.ts       # Family management
│   │   ├── categories.ts     # Category management
│   │   └── products.ts       # Product management
│   └── types/
│       ├── unopim.ts         # UnoPim API types
│       └── tools.ts          # Tool input/output types
├── package.json
├── tsconfig.json
└── README.md
```

### 7.3 Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "tsup": "^8.0.0"
  }
}
```

---

## 8. Sikkerhed

### 8.1 Credential Håndtering

- Credentials opbevares KUN i environment variabler
- Aldrig logged eller inkluderet i error messages
- Token caches kun i hukommelse, aldrig persisteret

### 8.2 Input Validation

- Alle tool inputs valideres med Zod schemas
- Code-felter saniteres (kun alfanumerisk + underscore)
- SQL injection ikke relevant (REST API)

### 8.3 Rate Limiting

- Respektér UnoPim's rate limits
- Implementér client-side throttling ved bulk operations
- Exponential backoff ved 429 responses

---

## 9. Test Strategi

### 9.1 Unit Tests

- Auth token management
- Input validation
- Error handling

### 9.2 Integration Tests

- Kræver test UnoPim instans
- Full workflow tests
- Error scenario tests

### 9.3 Manual Test Checklist

| Test | Forventet Resultat |
|------|-------------------|
| Opret attribut med alle typer | Success |
| Opret family med attributter | Success |
| Opret produkt med værdier | Success |
| Duplikat attribut code | Proper error |
| Ugyldig family reference | Proper error |
| Token refresh | Transparent retry |

---

## 10. Prioritering

### 10.1 Must Have (v1.0)

- Authentication med OAuth2 password grant
- Token refresh håndtering
- Alle schema tools (`unopim_get_schema`, `unopim_get_attributes`, `unopim_get_families`)
- Alle attribute tools (`unopim_create_attribute`, `unopim_create_attribute_options`)
- Attribute group tool (`unopim_create_attribute_group`)
- Family tools (`unopim_create_family`, `unopim_update_family`)
- Category tools (`unopim_get_categories`, `unopim_create_category`)
- Product tools (`unopim_create_product`, `unopim_create_configurable_product`, `unopim_bulk_create_products`)
- Error handling med retry logic
- Zod validation på alle inputs

### 10.2 Should Have (v1.1+)

| Feature | Beskrivelse |
|---------|-------------|
| Delete operations | `unopim_delete_attribute`, `unopim_delete_product`, etc. |
| Schema caching | Cache datamodel lokalt for at reducere API kald |
| N8N webhooks | Trigger N8N workflows ved ændringer |
| Batch optimization | Intelligent batching af API kald |

### 10.3 Future (v2.0+)

| Feature | Beskrivelse |
|---------|-------------|
| Media håndtering | Upload/link billeder og filer |
| Channel management | Opret og konfigurer channels |
| Export tools | Eksportér data fra UnoPim |
| Diff/sync | Sammenlign og synkroniser datamodeller |

---

## 11. Åbne Spørgsmål

1. **Skal vi understøtte flere samtidige UnoPim-versioner?** API'et ser stabilt ud, men versionscheck kunne være relevant.

2. **Caching strategi?** Skal schema caches lokalt for at reducere API kald?

3. **Batch størrelse?** Hvad er optimal batch size for bulk operations?

---

## Appendix A: UnoPim API Endpoints Reference

| Resource | Method | Endpoint |
|----------|--------|----------|
| Auth | POST | `/oauth/token` |
| Locales | GET | `/api/v1/rest/locales` |
| Currencies | GET | `/api/v1/rest/currencies` |
| Channels | GET | `/api/v1/rest/channels` |
| Categories | GET/POST/PUT | `/api/v1/rest/categories` |
| Attributes | GET/POST/PUT | `/api/v1/rest/attributes` |
| Attribute Options | GET/POST/PUT | `/api/v1/rest/attributes/{code}/options` |
| Attribute Groups | GET/POST/PUT | `/api/v1/rest/attribute-groups` |
| Families | GET/POST/PUT | `/api/v1/rest/families` |
| Products | GET/POST/PUT | `/api/v1/rest/products` |
| Configurable Products | GET/POST/PUT | `/api/v1/rest/configrable-products` |

---

## Appendix B: Eksempel - Komplet Onboarding

**Input produktdata (CSV):**
```csv
sku,name_da,name_en,color,size,price_dkk,description_da
SHIRT-001,Klassisk Skjorte,Classic Shirt,blue,M,599,Flot bomulds skjorte
SHIRT-002,Klassisk Skjorte,Classic Shirt,blue,L,599,Flot bomulds skjorte
SHIRT-003,Klassisk Skjorte,Classic Shirt,white,M,599,Flot bomulds skjorte
```

**Claude's analyse og handlinger:**

1. Identificerer attributter: `sku`, `name` (lokaliseret), `color` (select), `size` (select), `price` (lokaliseret), `description` (lokaliseret)

2. Opretter attributter:
   - `color` (select, configurable)
   - `size` (select, configurable)
   - Genbruger eksisterende `sku`, `name`, `price`, `description`

3. Opretter options:
   - `color`: blue, white
   - `size`: M, L

4. Opretter family `shirts` med relevante attributter

5. Opretter konfigurerbart produkt med varianter

**Resultat:** Komplet produktstruktur i UnoPim klar til brug.

---

## Changelog

| Version | Dato | Ændringer |
|---------|------|-----------|
| 1.0 | 2026-01-12 | Initial draft |

---

## Appendix C: Claude Code Implementation Guide

Denne sektion er specifikt til brug med Claude Code for at starte implementeringen.

### Startkommando

```bash
# Opret projekt
mkdir unopim-mcp && cd unopim-mcp
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install -D typescript @types/node tsup
npx tsc --init
```

### Implementeringsrækkefølge

1. **Først:** `src/config.ts` - Environment variabler og konfiguration
2. **Så:** `src/auth/oauth.ts` - Token management
3. **Så:** `src/client/unopim-client.ts` - Base HTTP client med auth
4. **Så:** `src/types/` - TypeScript interfaces
5. **Så:** `src/tools/schema.ts` - Start med read-only tools
6. **Så:** `src/tools/attributes.ts`, `families.ts`, etc.
7. **Sidst:** `src/index.ts` - MCP server setup der samler det hele

### Vigtige implementeringsnoter

**OAuth Token Flow:**
```typescript
// Base64 encode client credentials
const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

// Request token
const response = await fetch(`${baseUrl}/oauth/token`, {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    username,
    password,
    grant_type: 'password'
  })
});
```

**MCP Tool Registration Pattern:**
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: 'unopim-mcp',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {}
  }
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'unopim_get_schema',
      description: 'Hent komplet datamodel fra UnoPim',
      inputSchema: { /* Zod schema converted to JSON Schema */ }
    },
    // ... flere tools
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case 'unopim_get_schema':
      return handleGetSchema(request.params.arguments);
    // ... flere handlers
  }
});
```

**Test lokalt:**
```bash
# Build
npm run build

# Test med MCP Inspector
npx @modelcontextprotocol/inspector dist/index.js
```
