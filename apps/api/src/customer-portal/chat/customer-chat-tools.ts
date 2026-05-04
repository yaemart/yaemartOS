import { tool } from 'ai';
import { z } from 'zod';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { TicketService, TicketPriority } from '../ticket/ticket.service';
import type { WarrantyService } from '../warranty/warranty.service';
import type { ManualService } from '../manual/manual.service';
import type { OrderLookupService } from '../order-lookup/order-lookup.service';

/**
 * Vercel AI SDK tool registry for the customer-portal chat assistant.
 *
 * See [ADR-012](../../../../../docs/adr/ADR-012-customer-chat-tool-calling.md):
 *
 *  - **D1**: 8-tool customer-self mirror (ticket / warranty / order /
 *    manual). Admin-only mutations (close, assign, status flip, etc.)
 *    are explicitly excluded from this set.
 *  - **D2**: IAM is enforced inside `execute` against `ctx.customerId`,
 *    which `ChatService` derives from the *validated* chat session.
 *    LLM-supplied tool args never carry `customerId`.
 *  - **D3**: Errors are returned as structured `{ ok: false, error,
 *    message }` so the LLM can phrase a graceful reply; we do NOT throw
 *    out of `execute` (Vercel AI SDK would otherwise abort streaming).
 *
 * Anyone tempted to "just add `customerId` to inputSchema" should reread
 * D2 — that single line is what stops a prompt-injection attacker from
 * pivoting one customer's chat session into another customer's tickets.
 */

export interface CustomerChatToolsContext {
  /** Logged-in customer id. `null` for anonymous chat sessions. */
  customerId: string | null;
  /** Brand resolved from `CustomerTenantGuard` — purely informational. */
  brandId: string;
  /** Locale tag the customer is chatting in (e.g. "en", "es"). */
  locale: string;
  ticket: TicketService;
  warranty: WarrantyService;
  manual: ManualService;
  orderLookup: OrderLookupService;
}

/** Stable error codes — see ADR-012 §D3. */
type ToolErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'UNKNOWN_ERROR';

interface ToolFailure {
  ok: false;
  error: ToolErrorCode;
  message: string;
}

interface ToolSuccess<T> {
  ok: true;
  data: T;
}

type ToolResult<T> = ToolSuccess<T> | ToolFailure;

const ok = <T>(data: T): ToolSuccess<T> => ({ ok: true, data });
const fail = (error: ToolErrorCode, message: string): ToolFailure => ({
  ok: false,
  error,
  message,
});

/**
 * Translate any thrown error from a service call into a stable
 * `ToolFailure` envelope the LLM can reason about.
 */
function classify(err: unknown): ToolFailure {
  if (err instanceof NotFoundException) {
    return fail('NOT_FOUND', err.message);
  }
  if (err instanceof ForbiddenException) {
    return fail('FORBIDDEN', err.message);
  }
  if (err instanceof BadRequestException) {
    return fail('BAD_REQUEST', err.message);
  }
  const msg = err instanceof Error ? err.message : String(err);
  return fail('UNKNOWN_ERROR', msg);
}

/** Authenticated guard: most tools refuse to run without a logged-in customer. */
function requireCustomer(
  ctx: CustomerChatToolsContext,
): { ok: true; customerId: string } | ToolFailure {
  if (!ctx.customerId) {
    return fail(
      'NOT_AUTHENTICATED',
      'This action requires a signed-in customer account. Please ask the user to log in to their customer portal.',
    );
  }
  return { ok: true, customerId: ctx.customerId };
}

const VALID_PRIORITIES: ReadonlyArray<TicketPriority> = ['low', 'normal', 'high', 'urgent'];

/**
 * Build the customer-portal chat tool registry bound to this chat
 * session's context. Returned object is the value passed to
 * `streamText({ tools })`.
 *
 * The return type is intentionally inferred — each tool has a distinct
 * `parameters` shape, and Vercel AI SDK 4.x's `tool()` helper preserves
 * those generics so the LLM call site gets exact arg typing. Forcing a
 * common `Record<string, Tool>` constraint widens to `unknown` and
 * fails the satisfaction check.
 */
export function buildCustomerChatTools(ctx: CustomerChatToolsContext) {
  return {
    listMyTickets: tool({
      description:
        'List the support tickets that belong to the currently logged-in customer. Use when the customer asks about their open tickets, ticket history, or follow-ups. Returns id, ticketNo, subject, status, priority, tags, and createdAt for each ticket.',
      parameters: z.object({
        page: z.number().int().min(1).max(100).optional().describe('Page number, default 1'),
        limit: z.number().int().min(1).max(50).optional().describe('Page size, default 20, max 50'),
      }),
      execute: async (args): Promise<ToolResult<unknown>> => {
        const auth = requireCustomer(ctx);
        if ('ok' in auth && auth.ok !== true) {
          return auth;
        }
        try {
          const result = await ctx.ticket.findByCustomer(
            auth.customerId,
            args.page ?? 1,
            args.limit ?? 20,
          );
          return ok(result);
        } catch (err) {
          return classify(err);
        }
      },
    }),

    createCustomerTicket: tool({
      description:
        'Create a new support ticket on behalf of the logged-in customer. Use when the customer wants to escalate or formally report an issue. Returns the created ticket including ticketNo and the seeded initial message. Do NOT call this for casual questions — first try to answer from FAQs.',
      parameters: z.object({
        subject: z
          .string()
          .min(3)
          .max(200)
          .describe('A short subject summarising the issue (3-200 chars)'),
        initialMessage: z
          .string()
          .min(5)
          .max(4000)
          .describe('The first message body — describe the issue in the customer voice'),
        priority: z
          .enum(['low', 'normal', 'high', 'urgent'])
          .optional()
          .describe(
            'Ticket priority, default normal. Only escalate to high/urgent if explicitly requested.',
          ),
        tags: z
          .array(z.string().min(1).max(40))
          .max(10)
          .optional()
          .describe('Optional tags, e.g. ["return-request", "shipping"]'),
      }),
      execute: async (args): Promise<ToolResult<unknown>> => {
        const auth = requireCustomer(ctx);
        if ('ok' in auth && auth.ok !== true) {
          return auth;
        }
        try {
          const priority =
            args.priority && VALID_PRIORITIES.includes(args.priority) ? args.priority : 'normal';
          const ticket = await ctx.ticket.create({
            customerId: auth.customerId,
            subject: args.subject,
            initialMessage: args.initialMessage,
            priority,
            tags: args.tags ?? [],
          });
          return ok({
            id: ticket.id,
            ticketNo: ticket.ticketNo,
            subject: ticket.subject,
            status: ticket.status,
            priority: ticket.priority,
            tags: ticket.tags,
          });
        } catch (err) {
          return classify(err);
        }
      },
    }),

    addCustomerTicketMessage: tool({
      description:
        'Append a customer message to an existing ticket thread. Use when the customer wants to add information to a ticket they already opened (e.g. providing an order number or photo description). The senderType is always recorded as "customer" — agents cannot impersonate. Closed tickets cannot accept new messages.',
      parameters: z.object({
        ticketId: z.string().min(1).describe('The ticket ID returned by listMyTickets'),
        content: z.string().min(1).max(4000).describe('The message body in the customer voice'),
      }),
      execute: async (args): Promise<ToolResult<unknown>> => {
        const auth = requireCustomer(ctx);
        if ('ok' in auth && auth.ok !== true) {
          return auth;
        }
        try {
          const message = await ctx.ticket.addMessage({
            ticketId: args.ticketId,
            customerId: auth.customerId,
            content: args.content,
            senderType: 'customer',
          });
          return ok({
            id: message.id,
            ticketId: args.ticketId,
            senderType: 'customer',
          });
        } catch (err) {
          return classify(err);
        }
      },
    }),

    listMyWarranties: tool({
      description:
        'List warranty registrations for the logged-in customer. Use when the customer asks about their warranty status, expiry dates, or registered products. Returns productSku, serialNumber, purchaseDate, warrantyExpiresAt, and status for each registration.',
      parameters: z.object({}),
      execute: async (): Promise<ToolResult<unknown>> => {
        const auth = requireCustomer(ctx);
        if ('ok' in auth && auth.ok !== true) {
          return auth;
        }
        try {
          const rows = await ctx.warranty.listByCustomer(auth.customerId);
          return ok(rows);
        } catch (err) {
          return classify(err);
        }
      },
    }),

    registerWarranty: tool({
      description:
        'Register a new warranty for the logged-in customer. The customer can register without an invoice attached via this tool — afterward, remind them they should upload the proof-of-purchase image in the customer portal warranty page within 30 days for the registration to be honoured. Defaults to a 12-month warranty from purchaseDate.',
      parameters: z.object({
        productSku: z.string().min(1).max(80).describe('The product SKU being registered'),
        serialNumber: z
          .string()
          .min(1)
          .max(80)
          .describe('Product serial number from the box or device'),
        purchaseDate: z.string().describe('Purchase date in ISO 8601 format (YYYY-MM-DD)'),
        platform: z
          .string()
          .max(40)
          .optional()
          .describe('Platform purchased on, e.g. amazon, walmart, brand_site'),
        shopOrderId: z
          .string()
          .max(80)
          .optional()
          .describe('Order id from the platform (helps support agents cross-check)'),
      }),
      execute: async (args): Promise<ToolResult<unknown>> => {
        const auth = requireCustomer(ctx);
        if ('ok' in auth && auth.ok !== true) {
          return auth;
        }
        try {
          const result = await ctx.warranty.register(
            auth.customerId,
            {
              productSku: args.productSku,
              serialNumber: args.serialNumber,
              purchaseDate: args.purchaseDate,
              platform: args.platform,
              shopOrderId: args.shopOrderId,
            },
            undefined,
            ctx.locale,
          );
          return ok({
            ...result,
            invoiceFollowUpRequired: true,
            invoiceFollowUpInstruction:
              'Please upload your proof-of-purchase image in the customer portal warranty page within 30 days.',
          });
        } catch (err) {
          return classify(err);
        }
      },
    }),

    customerOrderLookup: tool({
      description:
        "Look up the shipping status of one of the logged-in customer's orders by order number. Skips the public CAPTCHA gate because the chat session is already authenticated. Returns shipping status, tracking number, and estimated delivery — or a not-found message.",
      parameters: z.object({
        orderNumber: z
          .string()
          .min(3)
          .max(80)
          .describe('The order number the customer is asking about'),
      }),
      execute: async (args): Promise<ToolResult<unknown>> => {
        const auth = requireCustomer(ctx);
        if ('ok' in auth && auth.ok !== true) {
          return auth;
        }
        try {
          const result = await ctx.orderLookup.lookupForChatTool(auth.customerId, args.orderNumber);
          return ok(result);
        } catch (err) {
          return classify(err);
        }
      },
    }),

    listProductManuals: tool({
      description:
        'List product manuals available for this brand. Optionally filter to a specific SKU. Returns productSku, locale, filename, and download URL for each manual. This tool is available even for anonymous chats — use it freely when the customer asks about a manual or download.',
      parameters: z.object({
        sku: z
          .string()
          .min(1)
          .max(80)
          .optional()
          .describe('Filter to a specific product SKU (optional)'),
      }),
      execute: async (args): Promise<ToolResult<unknown>> => {
        try {
          const rows = await ctx.manual.listManuals(args.sku);
          return ok(rows);
        } catch (err) {
          return classify(err);
        }
      },
    }),

    getProductManual: tool({
      description:
        'Get the download URL for a specific product manual by SKU and locale. Falls back to the English manual if the requested locale is not available. Always available, even for anonymous chats.',
      parameters: z.object({
        sku: z.string().min(1).max(80).describe('Product SKU'),
        locale: z
          .string()
          .min(2)
          .max(10)
          .describe('Language code, e.g. en, de, fr, ja (falls back to en)'),
      }),
      execute: async (args): Promise<ToolResult<unknown>> => {
        try {
          const result = await ctx.manual.getManual(args.sku, args.locale);
          return ok(result);
        } catch (err) {
          return classify(err);
        }
      },
    }),
  };
}

/**
 * Render a compact `name: description` summary suitable for splicing
 * into the chat system prompt. Single source of truth — adding a tool
 * above flows through to the prompt automatically (see ADR-012 §D5).
 */
export function describeCustomerChatTools(tools: Record<string, { description?: string }>): string {
  return Object.entries(tools)
    .map(([name, t]) => `- ${name}: ${t.description ?? ''}`)
    .join('\n');
}
