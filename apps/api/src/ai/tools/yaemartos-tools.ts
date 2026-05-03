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
      'Trigger AI generation of a listing draft for the specified listing ID and locale. Returns a new draft ListingVersion. The draft must be manually activated by an operator.',
    method: 'POST',
    endpoint: '/listings/:id/generate',
    parameters: {
      id: { type: 'string', description: 'The listing ID to generate a draft for', required: true },
      locale: {
        type: 'string',
        description: 'Target language locale for generation (e.g. en, de)',
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
      'Batch-generate listing drafts for multiple shop/platform/language combinations. Feature-flagged by MULTILINGUAL_LISTING_GENERATION. Returns per-combo results.',
    method: 'POST',
    endpoint: '/listings/batch-generate',
    parameters: {
      listingId: { type: 'string', description: 'The listing ID to generate for', required: true },
      targets: {
        type: 'array',
        description: 'Array of {shopId, platformCode} target combinations',
        required: true,
      },
      languages: {
        type: 'array',
        description: 'List of language codes to generate (e.g. ["en", "de", "fr"])',
        required: false,
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
];
