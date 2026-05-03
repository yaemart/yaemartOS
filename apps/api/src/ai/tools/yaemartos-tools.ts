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
