import type { LingxingToolDescriptor } from './lingxing-tools';

/**
 * MCP-style descriptors for the yaemartOS platform's own REST API endpoints.
 * Agents discover these via GET /ai/mcp/tools and call the corresponding
 * REST endpoints (authenticated with an operator JWT).
 *
 * Convention: `endpoint` and `method` describe the HTTP surface so that
 * agents can construct calls without additional documentation.
 */
export type YaemartOsToolDescriptor = LingxingToolDescriptor & {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  endpoint: string;
};

export const YAEMARTOS_TOOL_DESCRIPTORS: YaemartOsToolDescriptor[] = [
  // ── Listing ──────────────────────────────────────────────────────────────
  {
    name: 'listListings',
    description:
      'List all listings for the authenticated brand. Supports filtering by shopId, platformId, language, and status. Returns paginated results.',
    method: 'GET',
    endpoint: '/listings',
    parameters: {
      page: { type: 'number', description: 'Page number (default: 1)', required: false },
      pageSize: { type: 'number', description: 'Items per page (default: 20)', required: false },
      shopId: { type: 'string', description: 'Filter by shop ID', required: false },
      platformId: { type: 'string', description: 'Filter by platform ID', required: false },
      language: {
        type: 'string',
        description: 'Filter by language code (e.g. en, de, fr)',
        required: false,
      },
      status: {
        type: 'string',
        description: 'Filter by listing status (draft, active, archived)',
        required: false,
      },
    },
  },
  {
    name: 'getListing',
    description: 'Get a single listing and its active version content by listing ID.',
    method: 'GET',
    endpoint: '/listings/:id',
    parameters: {
      id: { type: 'string', description: 'The listing ID', required: true },
    },
  },
  {
    name: 'generateListingDraft',
    description:
      'Trigger AI generation of a listing draft for the specified listing ID. Returns a new draft ListingVersion. The draft must be manually activated by an operator.',
    method: 'POST',
    endpoint: '/listings/:id/generate',
    parameters: {
      id: { type: 'string', description: 'The listing ID to generate a draft for', required: true },
      productTitle: {
        type: 'string',
        description: 'Product title used as generation seed',
        required: false,
      },
      productCategory: {
        type: 'string',
        description: 'Product category for AI context',
        required: false,
      },
      competitorUrls: {
        type: 'array',
        description: 'Array of competitor listing URLs to analyse for inspiration',
        required: false,
      },
      manualSellingPoints: {
        type: 'string',
        description: 'Operator-supplied selling points to incorporate',
        required: false,
      },
      categoryLexicon: {
        type: 'array',
        description: 'Category-specific keywords to include',
        required: false,
      },
      lingxingKeywordSeed: {
        type: 'array',
        description: 'Lingxing keyword seeds from keyword research',
        required: false,
      },
    },
  },
  {
    name: 'listListingVersions',
    description: 'List all versions of a listing, ordered by version number descending.',
    method: 'GET',
    endpoint: '/listings/:id/versions',
    parameters: {
      id: { type: 'string', description: 'The listing ID', required: true },
    },
  },
  {
    name: 'activateListingVersion',
    description:
      'Activate a specific version of a listing by version number. Archives the currently active version. Requires operator permission.',
    method: 'PATCH',
    endpoint: '/listings/:id/versions/:versionNumber/activate',
    parameters: {
      id: { type: 'string', description: 'The listing ID', required: true },
      versionNumber: {
        type: 'number',
        description: 'The version number to activate',
        required: true,
      },
    },
  },
  {
    name: 'batchGenerateListings',
    description:
      'Batch-generate listing drafts for multiple shop/platform/language combinations. Feature-flagged by MULTILINGUAL_LISTING_GENERATION. Returns per-combo {listingId, shopId, platformCode, language, versionNumber, status} results.',
    method: 'POST',
    endpoint: '/listings/batch-generate',
    parameters: {
      productId: {
        type: 'string',
        description: 'The product ID to generate listings for',
        required: true,
      },
      brandId: {
        type: 'string',
        description: 'Brand ID (must match authenticated brand)',
        required: true,
      },
      marketId: { type: 'string', description: 'Market ID for this batch', required: true },
      productTitle: {
        type: 'string',
        description: 'Product title used as generation seed',
        required: true,
      },
      productCategory: {
        type: 'string',
        description: 'Product category for AI context',
        required: true,
      },
      languages: {
        type: 'array',
        description: 'List of language codes to generate (e.g. ["en", "de", "fr"])',
        required: true,
      },
      targets: {
        type: 'array',
        description:
          'Array of {shopId, platformCode, platformListingId, competitorUrls?, manualSellingPoints?, categoryLexicon?, lingxingKeywordSeed?} target combinations',
        required: true,
      },
    },
  },

  // ── Product Manuals (customer-portal, public — requires x-yaemart-brand) ─
  {
    name: 'listProductManuals',
    description:
      'List product manuals available for the brand. Optionally filter by productSku. Returns sku, locale, filename, and download URL for each manual.',
    method: 'GET',
    endpoint: '/customer/manuals',
    parameters: {
      sku: {
        type: 'string',
        description: 'Filter by product SKU (optional)',
        required: false,
      },
    },
  },
  {
    name: 'getProductManual',
    description:
      'Get the download URL for a specific product manual by SKU and locale. Falls back to English if the requested locale is not available.',
    method: 'GET',
    endpoint: '/customer/manuals/:sku/:locale',
    parameters: {
      sku: { type: 'string', description: 'Product SKU', required: true },
      locale: {
        type: 'string',
        description: 'Language code, e.g. en, de, fr, ja (falls back to en)',
        required: true,
      },
    },
  },

  // ── Admin Manuals (operator CRUD — requires operator JWT + x-yaemart-brand) ─
  {
    name: 'uploadProductManual',
    description:
      'Upload or replace a product manual PDF/file for a specific SKU and locale. Accepts multipart/form-data with field "manualFile". Returns the stored manual record.',
    method: 'POST',
    endpoint: '/admin/manuals',
    parameters: {
      productSku: { type: 'string', description: 'Product SKU', required: true },
      locale: {
        type: 'string',
        description: 'Language code for this manual (e.g. en, de)',
        required: true,
      },
      manualFile: {
        type: 'file',
        description: 'The PDF or document file to upload (multipart)',
        required: true,
      },
    },
  },
  {
    name: 'deleteProductManual',
    description: 'Delete a product manual for a specific SKU and locale. Returns 204 on success.',
    method: 'DELETE',
    endpoint: '/admin/manuals/:sku/:locale',
    parameters: {
      sku: { type: 'string', description: 'Product SKU', required: true },
      locale: { type: 'string', description: 'Language code', required: true },
    },
  },

  // ── Admin Warranties (operator view — requires operator JWT + x-yaemart-brand) ─
  {
    name: 'listWarrantyRegistrations',
    description:
      'List warranty registrations for the brand. Supports filtering by status and productSku. Useful for support agents reviewing customer warranty coverage.',
    method: 'GET',
    endpoint: '/admin/warranties',
    parameters: {
      status: {
        type: 'string',
        description: 'Filter by status: active, expired, void',
        required: false,
      },
      productSku: { type: 'string', description: 'Filter by product SKU', required: false },
      customerId: { type: 'string', description: 'Filter by customer ID', required: false },
      page: { type: 'number', description: 'Page number (default: 1)', required: false },
      limit: { type: 'number', description: 'Items per page (max 100)', required: false },
    },
  },
  {
    name: 'getWarrantyRegistration',
    description:
      'Get full details of a single warranty registration by ID, including customer email, product SKU, expiry date, and invoice public ID.',
    method: 'GET',
    endpoint: '/admin/warranties/:warrantyId',
    parameters: {
      warrantyId: { type: 'string', description: 'The warranty registration ID', required: true },
    },
  },
  {
    name: 'updateWarrantyStatus',
    description:
      'Update the status of a warranty registration (e.g. void an invalid registration). Requires operator permission.',
    method: 'PATCH',
    endpoint: '/admin/warranties/:warrantyId/status',
    parameters: {
      warrantyId: { type: 'string', description: 'The warranty registration ID', required: true },
      status: {
        type: 'string',
        description: 'New status: active, expired, void',
        required: true,
      },
    },
  },

  // ── Admin Order Lookup (operator, no CAPTCHA — requires operator JWT) ─────
  {
    name: 'lookupOrderStatus',
    description:
      'Look up the status of a customer order by order number. Operator-side endpoint bypasses CAPTCHA. Returns shipping status, tracking number, and estimated delivery.',
    method: 'POST',
    endpoint: '/admin/order-lookup',
    parameters: {
      orderNumber: {
        type: 'string',
        description: 'The order number to look up',
        required: true,
      },
    },
  },

  // ── Admin Customers ──────────────────────────────────────────────────────
  {
    name: 'listCustomers',
    description:
      'List customers for a brand (admin view). Returns paginated results with warranty and ticket counts. Excludes sensitive auth fields (passwordHash, tokens).',
    method: 'GET',
    endpoint: '/admin/customers',
    parameters: {
      brandId: {
        type: 'string',
        description: 'Brand ID to list customers for (required)',
        required: true,
      },
      search: {
        type: 'string',
        description: 'Search by email or name (case-insensitive contains)',
        required: false,
      },
      isActive: {
        type: 'boolean',
        description: 'Filter by account active status (true/false)',
        required: false,
      },
      page: { type: 'number', description: 'Page number (default 1)', required: false },
      limit: { type: 'number', description: 'Page size, max 100 (default 50)', required: false },
    },
  },
  {
    name: 'getCustomer',
    description:
      'Get a single customer by ID for a brand. Returns customer profile plus recent warranties and tickets (up to 10 each). Excludes sensitive auth fields.',
    method: 'GET',
    endpoint: '/admin/customers/:customerId',
    parameters: {
      customerId: { type: 'string', description: 'The customer ID', required: true },
      brandId: {
        type: 'string',
        description: 'Brand ID (required — customers are per-brand)',
        required: true,
      },
    },
  },

  // ── Admin Tickets ────────────────────────────────────────────────────────
  {
    name: 'listAdminTickets',
    description:
      'Cross-brand ticket aggregation for admin users. Returns tickets from all brand schemas with optional filtering by status, priority, and brandId.',
    method: 'GET',
    endpoint: '/admin/tickets',
    parameters: {
      status: {
        type: 'string',
        description: 'Filter by ticket status (open, in_progress, resolved, closed)',
        required: false,
      },
      priority: {
        type: 'string',
        description: 'Filter by priority (low, normal, high, urgent)',
        required: false,
      },
      brandId: { type: 'string', description: 'Filter by brand slug', required: false },
      page: { type: 'number', description: 'Page number', required: false },
      limit: { type: 'number', description: 'Items per page (max 200)', required: false },
    },
  },
  {
    name: 'updateTicketStatus',
    description:
      'Update the status of a ticket. Requires operator permission. Supply x-yaemart-brand header to identify brand schema.',
    method: 'PATCH',
    endpoint: '/customer/tickets/:ticketId/status',
    parameters: {
      ticketId: { type: 'string', description: 'The ticket ID', required: true },
      status: {
        type: 'string',
        description: 'New status: open, in_progress, resolved, or closed',
        required: true,
      },
    },
  },
  {
    name: 'assignTicket',
    description:
      'Assign a ticket to an operator/agent by user UUID. Requires operator permission. Supply x-yaemart-brand header.',
    method: 'PATCH',
    endpoint: '/customer/tickets/:ticketId/assign',
    parameters: {
      ticketId: { type: 'string', description: 'The ticket ID', required: true },
      assigneeId: { type: 'string', description: 'UUID of the operator to assign', required: true },
    },
  },
  {
    name: 'addAgentMessageToTicket',
    description:
      'Add a support agent reply to a ticket message thread. Requires operator permission. Supply x-yaemart-brand header.',
    method: 'POST',
    endpoint: '/customer/tickets/:ticketId/agent-messages',
    parameters: {
      ticketId: { type: 'string', description: 'The ticket ID', required: true },
      content: { type: 'string', description: 'The reply message content', required: true },
    },
  },
  {
    name: 'getAdminTicket',
    description:
      'Get full details of a single ticket by ID, including all thread messages and assignment history. Supply x-yaemart-brand header.',
    method: 'GET',
    endpoint: '/customer/tickets/:ticketId',
    parameters: {
      ticketId: { type: 'string', description: 'The ticket ID', required: true },
    },
  },
  {
    name: 'listTicketMessages',
    description:
      'List all messages in a ticket thread in chronological order. Useful for reviewing conversation history before replying.',
    method: 'GET',
    endpoint: '/customer/tickets/:ticketId/messages',
    parameters: {
      ticketId: { type: 'string', description: 'The ticket ID', required: true },
    },
  },

  // ── Listing CRUD (missing verbs) ─────────────────────────────────────────
  {
    name: 'createListing',
    description:
      'Create a new listing for the authenticated brand. Requires shopId, platformId, and a product reference. Returns the created listing with a new draft version.',
    method: 'POST',
    endpoint: '/listings',
    parameters: {
      shopId: { type: 'string', description: 'Shop ID the listing belongs to', required: true },
      platformId: {
        type: 'string',
        description: 'Platform ID (e.g. amazon, walmart)',
        required: true,
      },
      productId: {
        type: 'string',
        description: 'Product ID this listing promotes',
        required: false,
      },
      title: { type: 'string', description: 'Initial listing title', required: false },
      language: { type: 'string', description: 'Language code (default: en)', required: false },
    },
  },
  {
    name: 'updateListing',
    description:
      'Partially update listing metadata by listing ID. Does NOT update AI-generated content — use generateListingDraft + activateListingVersion for content changes.',
    method: 'PATCH',
    endpoint: '/listings/:id',
    parameters: {
      id: { type: 'string', description: 'The listing ID', required: true },
      shopId: { type: 'string', description: 'New shop ID', required: false },
      productId: { type: 'string', description: 'New product ID', required: false },
      status: {
        type: 'string',
        description: 'New listing status: draft | active | archived',
        required: false,
      },
      isPrimary: {
        type: 'boolean',
        description: 'Mark as primary listing for this product/shop',
        required: false,
      },
      trafficStrategy: {
        type: 'string',
        description: 'Traffic strategy tag',
        required: false,
      },
      title: {
        type: 'string',
        description: 'Override listing title (manual edit)',
        required: false,
      },
      description: {
        type: 'string',
        description: 'Override description (manual edit)',
        required: false,
      },
      bullets: {
        type: 'array',
        description: 'Override bullet points (manual edit)',
        required: false,
      },
      searchTerms: {
        type: 'string',
        description: 'Override backend search terms',
        required: false,
      },
    },
  },
  {
    name: 'deleteListing',
    description:
      'Permanently delete a listing and all its versions. This action is irreversible. Returns 204 on success.',
    method: 'DELETE',
    endpoint: '/listings/:id',
    parameters: {
      id: { type: 'string', description: 'The listing ID to delete', required: true },
    },
  },
  {
    name: 'getListingMatrix',
    description:
      'Get the listing generation matrix for a product — all shop/platform/language combinations and their generation status. Useful for identifying gaps before batch generation.',
    method: 'GET',
    endpoint: '/listings/matrix',
    parameters: {
      productId: {
        type: 'string',
        description: 'The product ID to get the matrix for',
        required: true,
      },
    },
  },

  // ── Products ─────────────────────────────────────────────────────────────
  {
    name: 'listProducts',
    description:
      'List all products for the authenticated brand. Supports filtering by categoryId and status. Returns paginated results.',
    method: 'GET',
    endpoint: '/products',
    parameters: {
      categoryId: { type: 'string', description: 'Filter by category ID', required: false },
      status: {
        type: 'string',
        description: 'Filter by status (active, archived)',
        required: false,
      },
      page: { type: 'number', description: 'Page number', required: false },
      pageSize: { type: 'number', description: 'Items per page', required: false },
    },
  },
  {
    name: 'getProduct',
    description: 'Get a single product by ID including its category and linked listings count.',
    method: 'GET',
    endpoint: '/products/:id',
    parameters: {
      id: { type: 'string', description: 'The product ID', required: true },
    },
  },
  {
    name: 'createProduct',
    description:
      'Create a new product under the authenticated brand. Returns the created product record.',
    method: 'POST',
    endpoint: '/products',
    parameters: {
      sku: {
        type: 'string',
        description: 'Product SKU (must be unique within brand)',
        required: true,
      },
      name: { type: 'string', description: 'Product display name', required: true },
      categoryId: { type: 'string', description: 'Category ID', required: false },
    },
  },
  {
    name: 'updateProduct',
    description: 'Partially update a product (name, categoryId, status, attributes).',
    method: 'PATCH',
    endpoint: '/products/:id',
    parameters: {
      id: { type: 'string', description: 'The product ID', required: true },
      name: { type: 'string', description: 'New product name', required: false },
      categoryId: { type: 'string', description: 'New category ID', required: false },
      status: { type: 'string', description: 'New status: active, archived', required: false },
    },
  },
  {
    name: 'updateProductContent',
    description:
      'Replace the full product content for a given locale. Body is {locale, payload} where payload is a free-form JSON object containing content fields (description, bulletPoints, imageUrls, attributes, etc.).',
    method: 'PUT',
    endpoint: '/products/:id/content',
    parameters: {
      id: { type: 'string', description: 'The product ID', required: true },
      locale: {
        type: 'string',
        description: 'Content locale: en | es | fr | de | it',
        required: true,
      },
      payload: {
        type: 'object',
        description:
          'Content payload — free-form object. Common keys: description (string), bulletPoints (string[]), imageUrls (string[]), attributes (object)',
        required: true,
      },
    },
  },
  {
    name: 'generateProductFaq',
    description:
      'Trigger AI generation of FAQ entries for a product based on its content and existing listing data. Returns an array of {question, answer} objects.',
    method: 'POST',
    endpoint: '/products/:id/faq',
    parameters: {
      id: { type: 'string', description: 'The product ID', required: true },
      locale: {
        type: 'string',
        description: 'Language code for FAQ generation (default: en)',
        required: false,
      },
    },
  },
  {
    name: 'deleteProduct',
    description:
      'Delete a product. Fails if the product has active listings. Returns 204 on success.',
    method: 'DELETE',
    endpoint: '/products/:id',
    parameters: {
      id: { type: 'string', description: 'The product ID', required: true },
    },
  },

  // ── Categories ───────────────────────────────────────────────────────────
  {
    name: 'listCategories',
    description:
      'List all product categories for the authenticated brand, including parent/child hierarchy.',
    method: 'GET',
    endpoint: '/categories',
    parameters: {
      parentId: { type: 'string', description: 'Filter by parent category ID', required: false },
    },
  },
  {
    name: 'getCategory',
    description: 'Get a category by ID including its listing template if one exists.',
    method: 'GET',
    endpoint: '/categories/:id',
    parameters: {
      id: { type: 'string', description: 'The category ID', required: true },
    },
  },
  {
    name: 'createCategory',
    description: 'Create a new product category. Optionally specify a parent for nested hierarchy.',
    method: 'POST',
    endpoint: '/categories',
    parameters: {
      name: { type: 'string', description: 'Category display name', required: true },
      parentId: {
        type: 'string',
        description: 'Parent category ID (for sub-categories)',
        required: false,
      },
    },
  },
  {
    name: 'updateCategory',
    description: 'Update a category name or parent.',
    method: 'PATCH',
    endpoint: '/categories/:id',
    parameters: {
      id: { type: 'string', description: 'The category ID', required: true },
      name: { type: 'string', description: 'New category name', required: false },
      parentId: { type: 'string', description: 'New parent category ID', required: false },
    },
  },
  {
    name: 'deleteCategory',
    description:
      'Delete a category. Fails if products are still assigned to it. Returns 204 on success.',
    method: 'DELETE',
    endpoint: '/categories/:id',
    parameters: {
      id: { type: 'string', description: 'The category ID', required: true },
    },
  },
  {
    name: 'getCategoryTemplate',
    description:
      'Get the listing generation template for a category (field schema and AI hints used during generation).',
    method: 'GET',
    endpoint: '/categories/:id/template',
    parameters: {
      id: { type: 'string', description: 'The category ID', required: true },
    },
  },
  {
    name: 'updateCategoryTemplate',
    description:
      'Set or replace the listing generation template for a category and locale. The body is a free-form JSON object whose keys are field names (e.g. titleTemplate, bulletsTemplate, faqTemplate). Template drives AI field constraints during generation.',
    method: 'PUT',
    endpoint: '/categories/:id/template',
    parameters: {
      id: { type: 'string', description: 'The category ID', required: true },
      locale: {
        type: 'string',
        description: 'Template locale: en | es | fr | de | it (query param)',
        required: false,
      },
      template: {
        type: 'object',
        description:
          'Free-form template object. Common keys: titleTemplate (string), bulletsTemplate (object), descriptionTemplate (string), faqTemplate (object)',
        required: true,
      },
    },
  },

  // ── Shops ────────────────────────────────────────────────────────────────
  {
    name: 'listShops',
    description:
      'List all shops configured for the authenticated brand. Returns shop ID, name, platform, market, and binding status.',
    method: 'GET',
    endpoint: '/shops',
    parameters: {
      platformId: {
        type: 'string',
        description: 'Filter by platform (amazon, walmart)',
        required: false,
      },
      marketId: { type: 'string', description: 'Filter by market ID', required: false },
    },
  },
  {
    name: 'getShop',
    description: 'Get a single shop by ID including its Lingxing binding and sync status.',
    method: 'GET',
    endpoint: '/shops/:id',
    parameters: {
      id: { type: 'string', description: 'The shop ID', required: true },
    },
  },
  {
    name: 'listAvailableLingxingShops',
    description:
      'List Lingxing ERP shops available to bind that are not yet bound to any yaemartOS shop.',
    method: 'GET',
    endpoint: '/shops/lingxing-available',
    parameters: {},
  },
  {
    name: 'createShop',
    description: 'Create a new shop for the authenticated brand.',
    method: 'POST',
    endpoint: '/shops',
    parameters: {
      name: { type: 'string', description: 'Shop display name', required: true },
      platformId: {
        type: 'string',
        description: 'Platform slug (amazon, walmart)',
        required: true,
      },
      marketId: { type: 'string', description: 'Market ID', required: true },
    },
  },
  {
    name: 'bindShopToLingxing',
    description: 'Bind a yaemartOS shop to a Lingxing ERP shop for order sync.',
    method: 'POST',
    endpoint: '/shops/:id/bind',
    parameters: {
      id: { type: 'string', description: 'The shop ID', required: true },
      lingxingShopId: {
        type: 'string',
        description: 'The Lingxing shop ID to bind',
        required: true,
      },
    },
  },
  {
    name: 'updateShopBinding',
    description: 'Update the Lingxing binding configuration for a shop, or unbind it entirely.',
    method: 'PATCH',
    endpoint: '/shops/:id/binding',
    parameters: {
      id: { type: 'string', description: 'The shop ID', required: true },
      lingxingShopId: {
        type: 'string',
        description: 'New Lingxing shop ID to rebind to',
        required: false,
      },
      syncEnabled: { type: 'boolean', description: 'Enable or disable data sync', required: false },
      unbind: {
        type: 'boolean',
        description:
          'Set to true to remove the Lingxing binding entirely (equivalent to calling unbindShop)',
        required: false,
      },
    },
  },
  {
    name: 'deleteShop',
    description: 'Delete a shop. Fails if the shop has active listings. Returns 204 on success.',
    method: 'DELETE',
    endpoint: '/shops/:id',
    parameters: {
      id: { type: 'string', description: 'The shop ID', required: true },
    },
  },

  // ── Markets ──────────────────────────────────────────────────────────────
  {
    name: 'listMarkets',
    description: 'List all markets configured for the brand (e.g. US, DE, FR, JP).',
    method: 'GET',
    endpoint: '/markets',
    parameters: {},
  },
  {
    name: 'getMarket',
    description: 'Get a market by ID including its configured locales.',
    method: 'GET',
    endpoint: '/markets/:id',
    parameters: {
      id: { type: 'string', description: 'The market ID', required: true },
    },
  },
  {
    name: 'createMarket',
    description: 'Create a new market (e.g. add a new country/region for a brand).',
    method: 'POST',
    endpoint: '/markets',
    parameters: {
      code: {
        type: 'string',
        description: 'ISO 3166-1 alpha-2 market code (e.g. US, DE)',
        required: true,
      },
      name: { type: 'string', description: 'Human-readable market name', required: true },
    },
  },
  {
    name: 'updateMarket',
    description: 'Update a market name or settings.',
    method: 'PATCH',
    endpoint: '/markets/:id',
    parameters: {
      id: { type: 'string', description: 'The market ID', required: true },
      name: { type: 'string', description: 'New market name', required: false },
    },
  },
  {
    name: 'deleteMarket',
    description:
      'Delete a market. Fails if shops are still assigned to it. Returns 204 on success.',
    method: 'DELETE',
    endpoint: '/markets/:id',
    parameters: {
      id: { type: 'string', description: 'The market ID', required: true },
    },
  },

  // ── Locales ──────────────────────────────────────────────────────────────
  {
    name: 'listLocales',
    description:
      'List locales configured for a market. Returns language code, displayName, and enabled status.',
    method: 'GET',
    endpoint: '/locales',
    parameters: {
      marketId: { type: 'string', description: 'Filter by market ID', required: false },
    },
  },
  {
    name: 'listAllLocales',
    description:
      'List all locales across all markets for the brand. Useful for building locale pickers.',
    method: 'GET',
    endpoint: '/locales/all',
    parameters: {},
  },
  {
    name: 'createLocale',
    description: 'Add a language locale to a market (e.g. enable French for the EU market).',
    method: 'POST',
    endpoint: '/locales/:marketId',
    parameters: {
      marketId: { type: 'string', description: 'The market ID', required: true },
      language: {
        type: 'string',
        description: 'BCP-47 language code (e.g. fr, de, ja)',
        required: true,
      },
      displayName: { type: 'string', description: 'Human-readable display name', required: false },
    },
  },
  {
    name: 'updateLocale',
    description: 'Update locale settings (displayName, enabled) for a market/language combination.',
    method: 'PATCH',
    endpoint: '/locales/:marketId/:language',
    parameters: {
      marketId: { type: 'string', description: 'The market ID', required: true },
      language: { type: 'string', description: 'The language code', required: true },
      displayName: { type: 'string', description: 'New display name', required: false },
      enabled: { type: 'boolean', description: 'Enable or disable this locale', required: false },
    },
  },
  {
    name: 'deleteLocale',
    description: 'Remove a locale from a market. Returns 204 on success.',
    method: 'DELETE',
    endpoint: '/locales/:marketId/:language',
    parameters: {
      marketId: { type: 'string', description: 'The market ID', required: true },
      language: { type: 'string', description: 'The language code to remove', required: true },
    },
  },

  // ── Settings ─────────────────────────────────────────────────────────────
  {
    name: 'getConnectionsHealth',
    description:
      'Get health status of all external service connections (Lingxing ERP, Cloudinary, Elasticsearch, etc.).',
    method: 'GET',
    endpoint: '/settings/connections',
    parameters: {},
  },
  {
    name: 'listFeatureFlags',
    description:
      'List all feature flags and their current values for the authenticated brand. Supports per-brand and per-market granularity.',
    method: 'GET',
    endpoint: '/settings/feature-flags',
    parameters: {},
  },
  {
    name: 'setFeatureFlag',
    description:
      'Enable or disable a feature flag by key. Key may be a dotted path (e.g. listing.batch_generate). Value should be true/false or a JSON object for complex flags.',
    method: 'PUT',
    endpoint: '/settings/feature-flags/:key',
    parameters: {
      key: { type: 'string', description: 'Feature flag key (dotted path)', required: true },
      value: { type: 'any', description: 'New flag value (boolean or object)', required: true },
    },
  },
  {
    name: 'getAiRoutingConfig',
    description: 'Get the current AI model routing configuration for each task type.',
    method: 'GET',
    endpoint: '/settings/ai-routing',
    parameters: {},
  },
  {
    name: 'setAiRoutingConfig',
    description: 'Update AI model routing for a specific task key (e.g. listing.generate, chat).',
    method: 'PUT',
    endpoint: '/settings/ai-routing/:key',
    parameters: {
      key: { type: 'string', description: 'Task routing key', required: true },
      model: { type: 'string', description: 'Model slug to use for this task', required: true },
      provider: {
        type: 'string',
        description: 'Provider name (google, openai, zhipu)',
        required: false,
      },
    },
  },
  {
    name: 'getAiCostDashboard',
    description:
      'Get AI cost and token usage statistics aggregated by task type and model over a rolling window.',
    method: 'GET',
    endpoint: '/settings/ai-cost',
    parameters: {},
  },
  {
    name: 'setAiBudget',
    description: 'Set a monthly spend budget cap for an AI task or model.',
    method: 'PUT',
    endpoint: '/settings/ai-budget/:key',
    parameters: {
      key: { type: 'string', description: 'Budget key (task or model slug)', required: true },
      limitUsd: { type: 'number', description: 'Monthly budget cap in USD', required: true },
    },
  },
  {
    name: 'listBrandThemes',
    description:
      'List brand theme configuration for all brands (CSS custom properties, display names, logos).',
    method: 'GET',
    endpoint: '/settings/brands',
    parameters: {},
  },
  {
    name: 'updateBrandTheme',
    description: 'Update the theme/branding settings for a specific brand.',
    method: 'PATCH',
    endpoint: '/settings/brands/:id',
    parameters: {
      id: { type: 'string', description: 'The brand ID', required: true },
      name: { type: 'string', description: 'Brand display name', required: false },
      themeColor: {
        type: 'string',
        description: 'CSS hex color for the primary brand theme (e.g. #1a73e8)',
        required: false,
      },
      logoUrl: { type: 'string', description: 'URL of the brand logo', required: false },
    },
  },

  // ── Terminology ──────────────────────────────────────────────────────────
  {
    name: 'listTerminology',
    description:
      'List brand terminology entries (term → definition pairs) used to enforce consistent vocabulary in AI-generated listings.',
    method: 'GET',
    endpoint: '/terminology',
    parameters: {
      page: { type: 'number', description: 'Page number', required: false },
      pageSize: { type: 'number', description: 'Items per page', required: false },
    },
  },
  {
    name: 'createTerminologyEntry',
    description: 'Add a new terminology entry for the brand.',
    method: 'POST',
    endpoint: '/terminology',
    parameters: {
      term: {
        type: 'string',
        description: 'The term (e.g. a product name or brand word)',
        required: true,
      },
      definition: {
        type: 'string',
        description: 'Definition or usage instruction for the term',
        required: true,
      },
    },
  },
  {
    name: 'updateTerminologyEntry',
    description: 'Update the definition or term text of an existing terminology entry.',
    method: 'PATCH',
    endpoint: '/terminology/:id',
    parameters: {
      id: { type: 'string', description: 'The terminology entry ID', required: true },
      term: { type: 'string', description: 'New term text', required: false },
      definition: { type: 'string', description: 'New definition', required: false },
    },
  },
  {
    name: 'deleteTerminologyEntry',
    description: 'Delete a terminology entry. Returns 204 on success.',
    method: 'DELETE',
    endpoint: '/terminology/:id',
    parameters: {
      id: { type: 'string', description: 'The terminology entry ID', required: true },
    },
  },
  {
    name: 'importTerminology',
    description:
      'Bulk-import terminology entries from a CSV or JSON payload. Existing terms with the same text are updated (upsert).',
    method: 'POST',
    endpoint: '/terminology/import',
    parameters: {
      entries: {
        type: 'array',
        description: 'Array of {term, definition} objects to import',
        required: true,
      },
    },
  },
  // ── Migration ────────────────────────────────────────────────────────────
  {
    name: 'listMigrationAvailableShops',
    description:
      'List Lingxing-bound shops available for Path A import, filtered by brandId (from x-yaemart-brand header) and platformCode. Used to populate the shop picker before triggering an import.',
    method: 'GET',
    endpoint: '/migration/path-a/shops',
    parameters: {
      platformCode: {
        type: 'string',
        description: 'Platform to filter by (e.g. amazon, walmart). Must be a valid PlatformCode.',
        required: true,
      },
    },
  },
  {
    name: 'triggerPathAImport',
    description:
      'Queue a Path A data import job for specified shops. Returns {jobId, runId, status}. Poll getPathAImportJob for progress. Requires migration:write permission.',
    method: 'POST',
    endpoint: '/migration/path-a/jobs',
    parameters: {
      brandId: { type: 'string', description: 'Brand ID to import data for', required: true },
      marketCode: { type: 'string', description: 'Market code (e.g. us, de)', required: true },
      platformCode: {
        type: 'string',
        description: 'Platform code (e.g. amazon, walmart)',
        required: true,
      },
      shopIds: {
        type: 'array',
        description: 'Array of Lingxing shop IDs to import from',
        required: true,
      },
    },
  },
  {
    name: 'getPathAImportJob',
    description:
      'Get the status and progress of a Path A import job. Returns {jobId, runId, status, progress (0-100), imported, failed, failures, error}.',
    method: 'GET',
    endpoint: '/migration/path-a/jobs/:jobId',
    parameters: {
      jobId: {
        type: 'string',
        description: 'The BullMQ job ID returned by triggerPathAImport',
        required: true,
      },
    },
  },
  {
    name: 'listPathAImportJobs',
    description:
      'List recent Path A import jobs grouped by status (waiting, active, completed, failed). Returns up to 10 per status.',
    method: 'GET',
    endpoint: '/migration/path-a/jobs',
    parameters: {},
  },

  {
    name: 'getAdDashboard',
    description:
      'Query aggregated advertising performance data (spend, sales, ACOS, CTR, CVR) for the authenticated brand. Returns daily buckets and overall totals grouped by ad type (SP/SD/SB/Walmart). Requires feature flag AD_DASHBOARD to be enabled.',
    method: 'GET',
    endpoint: '/ads/dashboard',
    parameters: {
      startDate: {
        type: 'string',
        description: 'Start date (YYYY-MM-DD). Must be within 90 days of endDate.',
        required: true,
      },
      endDate: {
        type: 'string',
        description: 'End date (YYYY-MM-DD, inclusive). Must be >= startDate.',
        required: true,
      },
      shopId: {
        type: 'string',
        description: 'Filter to a specific shop ID. Omit to aggregate across all brand shops.',
        required: false,
      },
      adType: {
        type: 'string',
        description:
          'Filter to a specific ad type: sp | sd | sb | walmart_sp. Omit to aggregate all.',
        required: false,
      },
    },
  },
  {
    name: 'triggerAdSync',
    description:
      'Manually trigger an advertising data sync for a specific shop on a given date. Useful for backfilling missed days or re-syncing after a Lingxing API outage. brandId is resolved from the authenticated user context.',
    method: 'POST',
    endpoint: '/ads/sync',
    parameters: {
      shopId: {
        type: 'string',
        description: 'The shop ID to sync ad data for.',
        required: true,
      },
      date: {
        type: 'string',
        description: 'The date to sync (YYYY-MM-DD).',
        required: true,
      },
    },
  },

  // ── Ad Suggestions (AI-powered optimization with execution gate) ─────────
  {
    name: 'generateAdSuggestions',
    description:
      'Generate AI-powered advertising optimization suggestions for breaching campaigns (high ACOS or low CTR). Uses GLM-5 model. Returns a batchId and the count of suggestions persisted with `pending` status. Subject to AI rate limit (10/min per brand) and AD_SUGGESTION feature flag.',
    method: 'POST',
    endpoint: '/ads/suggestions/generate',
    parameters: {
      shopId: { type: 'string', description: 'The shop ID to analyze.', required: true },
      startDate: {
        type: 'string',
        description: 'Optional start date (YYYY-MM-DD). Defaults to 30 days ago.',
        required: false,
      },
      endDate: {
        type: 'string',
        description: 'Optional end date (YYYY-MM-DD). Defaults to today.',
        required: false,
      },
    },
  },
  {
    name: 'listAdSuggestions',
    description:
      'List AI-generated ad-optimization suggestions for the authenticated brand. Filter by shop and status (pending/accepted/rejected/executed/expired). Pending suggestions past `expiresAt` are projected as `expired` in responses.',
    method: 'GET',
    endpoint: '/ads/suggestions',
    parameters: {
      shopId: { type: 'string', description: 'Filter by shop ID.', required: false },
      status: {
        type: 'string',
        description: 'Filter by status: pending | accepted | rejected | executed | expired',
        required: false,
      },
      page: { type: 'number', description: 'Page number (default 1)', required: false },
      limit: { type: 'number', description: 'Page size (default 50, max 200)', required: false },
    },
  },
  {
    name: 'getAdSuggestion',
    description:
      'Get a single AI-generated ad-optimization suggestion by ID. Returns full payload including campaignId, actionType, field, currentValue, suggestedValue, reason, and status.',
    method: 'GET',
    endpoint: '/ads/suggestions/:id',
    parameters: {
      id: { type: 'string', description: 'The suggestion ID', required: true },
    },
  },
  {
    name: 'executeAdSuggestion',
    description:
      'Execute a pending ad-optimization suggestion. Marks the suggestion as executed and creates an AdChange record carrying before/after values for 24h reversibility. MVP: records the change locally but does not push to Lingxing yet. Requires ads:write permission.',
    method: 'POST',
    endpoint: '/ads/suggestions/:id/execute',
    parameters: {
      id: { type: 'string', description: 'The suggestion ID to execute', required: true },
    },
  },
  {
    name: 'rejectAdSuggestion',
    description:
      'Reject a pending ad-optimization suggestion (operator decided not to apply it). Marks the suggestion as rejected without creating any AdChange.',
    method: 'POST',
    endpoint: '/ads/suggestions/:id/reject',
    parameters: {
      id: { type: 'string', description: 'The suggestion ID to reject', required: true },
    },
  },
  {
    name: 'listAdChanges',
    description:
      'List executed ad changes for the authenticated brand. Includes status (executed/rolled_back), before/after values, executedBy, executedAt, and reversibleBefore (the 24h rollback deadline). Useful for change history audit and finding rollback candidates.',
    method: 'GET',
    endpoint: '/ads/suggestions/changes',
    parameters: {
      shopId: { type: 'string', description: 'Filter by shop ID.', required: false },
      page: { type: 'number', description: 'Page number (default 1)', required: false },
      limit: { type: 'number', description: 'Page size (default 50, max 200)', required: false },
    },
  },
  {
    name: 'rollbackAdChange',
    description:
      'Rollback an executed ad change within its 24h reversibility window. Sets the change status to rolled_back and reverts the source AdSuggestion from executed back to pending so it can be re-evaluated. Throws if past `reversibleBefore`.',
    method: 'POST',
    endpoint: '/ads/suggestions/changes/:changeId/rollback',
    parameters: {
      changeId: { type: 'string', description: 'The ad change ID to rollback', required: true },
    },
  },

  // ── Terminology (single-entry read) ──────────────────────────────────────
  {
    name: 'getTerminologyEntry',
    description:
      'Get a single terminology entry by its ID. Returns term, definition, locale, brandId, and timestamps. Useful for verifying or quoting a specific term before updating it.',
    method: 'GET',
    endpoint: '/terminology/:id',
    parameters: {
      id: { type: 'string', description: 'The terminology entry ID', required: true },
    },
  },

  // ── Order Lookup History ──────────────────────────────────────────────────
  {
    name: 'listOrderLookupHistory',
    description:
      'List cached order-lookup records for a brand. These are orders that customers (or operators) have previously queried. Useful for agents to see what orders are being tracked and their last-known status. Requires admin auth + order_lookup:read permission.',
    method: 'GET',
    endpoint: '/admin/order-lookup/history',
    parameters: {
      brandId: {
        type: 'string',
        description: 'Brand slug to query lookup history for (required)',
        required: true,
      },
      customerId: {
        type: 'string',
        description: 'Filter to a specific customer ID',
        required: false,
      },
      page: { type: 'number', description: 'Page number (default: 1)', required: false },
      limit: {
        type: 'number',
        description: 'Items per page (max 100, default: 20)',
        required: false,
      },
    },
  },

  // ── Metrics ───────────────────────────────────────────────────────────────
  {
    name: 'listMetrics',
    description:
      'List recorded operational metric values (KPIs, health indicators, business counters). Filter by name or brandId. Returns up to 200 most-recent entries. Useful for agents to read current KPI values before making decisions.',
    method: 'GET',
    endpoint: '/metrics',
    parameters: {
      name: {
        type: 'string',
        description: 'Filter to a specific metric name (e.g. "listing.generate.cost_usd")',
        required: false,
      },
      brandId: { type: 'string', description: 'Filter to a specific brand', required: false },
      limit: {
        type: 'number',
        description: 'Max results to return (default: 50, max: 200)',
        required: false,
      },
    },
  },
  {
    name: 'recordMetric',
    description:
      'Record a new metric data point (numeric value with optional unit and brandId). Use to log operational KPIs, cost counters, or any measurable event that agents or automation should track over time.',
    method: 'POST',
    endpoint: '/metrics',
    parameters: {
      name: {
        type: 'string',
        description: 'Metric name slug (e.g. "listing.generate.cost_usd", "sync.errors.daily")',
        required: true,
      },
      value: {
        type: 'number',
        description: 'Numeric value to record',
        required: true,
      },
      unit: {
        type: 'string',
        description: 'Optional unit label (e.g. "usd", "count", "ms")',
        required: false,
      },
      brandId: {
        type: 'string',
        description: 'Optional brand slug to associate this metric with',
        required: false,
      },
    },
  },
];
