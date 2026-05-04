import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  buildCustomerChatTools,
  describeCustomerChatTools,
  type CustomerChatToolsContext,
} from './customer-chat-tools';
import type { TicketService } from '../ticket/ticket.service';
import type { WarrantyService } from '../warranty/warranty.service';
import type { ManualService } from '../manual/manual.service';
import type { OrderLookupService } from '../order-lookup/order-lookup.service';

type ExecuteFn = (
  args: Record<string, unknown>,
  options?: Record<string, unknown>,
) => Promise<unknown>;

function callExecute(t: unknown, args: Record<string, unknown> = {}): Promise<unknown> {
  const exec = (t as { execute: ExecuteFn }).execute;
  return exec(args, { toolCallId: 'tc-1', messages: [] });
}

interface MockServices {
  ticket: TicketService;
  warranty: WarrantyService;
  manual: ManualService;
  orderLookup: OrderLookupService;
}

function makeMockServices(): {
  services: MockServices;
  spies: {
    findByCustomer: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    addMessage: ReturnType<typeof vi.fn>;
    listWarranty: ReturnType<typeof vi.fn>;
    register: ReturnType<typeof vi.fn>;
    listManuals: ReturnType<typeof vi.fn>;
    getManual: ReturnType<typeof vi.fn>;
    lookupForChatTool: ReturnType<typeof vi.fn>;
  };
} {
  const findByCustomer = vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
  const create = vi.fn().mockResolvedValue({
    id: 't-1',
    ticketNo: 'HO-20260504-0001',
    subject: 'Order issue',
    status: 'open',
    priority: 'normal',
    tags: [],
  });
  const addMessage = vi.fn().mockResolvedValue({ id: 'm-1' });
  const listWarranty = vi.fn().mockResolvedValue([]);
  const register = vi.fn().mockResolvedValue({
    id: 'w-1',
    productSku: 'SKU-1',
    serialNumber: 'SN-1',
    warrantyExpiresAt: '2027-05-04T00:00:00.000Z',
    status: 'active',
  });
  const listManuals = vi.fn().mockResolvedValue([
    {
      productSku: 'SKU-1',
      locale: 'en',
      filename: 'manual.pdf',
      secureUrl: 'https://example/sku-1-en.pdf',
    },
  ]);
  const getManual = vi.fn().mockResolvedValue({
    productSku: 'SKU-1',
    locale: 'en',
    filename: 'manual.pdf',
    secureUrl: 'https://example/sku-1-en.pdf',
  });
  const lookupForChatTool = vi.fn().mockResolvedValue({
    found: true,
    orderNumber: 'ORD-123',
    status: 'shipped',
    trackingNumber: '1Z',
    estimatedDelivery: '2026-05-10',
  });

  const services: MockServices = {
    ticket: { findByCustomer, create, addMessage } as unknown as TicketService,
    warranty: { listByCustomer: listWarranty, register } as unknown as WarrantyService,
    manual: { listManuals, getManual } as unknown as ManualService,
    orderLookup: { lookupForChatTool } as unknown as OrderLookupService,
  };

  return {
    services,
    spies: {
      findByCustomer,
      create,
      addMessage,
      listWarranty,
      register,
      listManuals,
      getManual,
      lookupForChatTool,
    },
  };
}

function makeCtx(overrides?: Partial<CustomerChatToolsContext>): CustomerChatToolsContext {
  const { services } = makeMockServices();
  return {
    customerId: 'cust-1',
    brandId: 'homtone',
    locale: 'en',
    ...services,
    ...overrides,
  };
}

describe('buildCustomerChatTools', () => {
  describe('IAM enforcement (ADR-012 §D2)', () => {
    it('refuses listMyTickets for anonymous chat sessions', async () => {
      const tools = buildCustomerChatTools(makeCtx({ customerId: null }));
      const result = (await callExecute(tools.listMyTickets, {})) as {
        ok: boolean;
        error: string;
      };
      expect(result.ok).toBe(false);
      expect(result.error).toBe('NOT_AUTHENTICATED');
    });

    it('refuses createCustomerTicket for anonymous chat sessions', async () => {
      const tools = buildCustomerChatTools(makeCtx({ customerId: null }));
      const result = (await callExecute(tools.createCustomerTicket, {
        subject: 'Help',
        initialMessage: 'I need help with my order',
      })) as { ok: boolean; error: string };
      expect(result.ok).toBe(false);
      expect(result.error).toBe('NOT_AUTHENTICATED');
    });

    it('allows listProductManuals for anonymous chat sessions', async () => {
      const { services, spies } = makeMockServices();
      const tools = buildCustomerChatTools({
        customerId: null,
        brandId: 'homtone',
        locale: 'en',
        ...services,
      });
      const result = (await callExecute(tools.listProductManuals, {})) as {
        ok: boolean;
      };
      expect(result.ok).toBe(true);
      expect(spies.listManuals).toHaveBeenCalled();
    });

    it('ignores LLM-supplied customerId — the bound ctx.customerId always wins', async () => {
      const { services, spies } = makeMockServices();
      const tools = buildCustomerChatTools({
        customerId: 'real-customer',
        brandId: 'homtone',
        locale: 'en',
        ...services,
      });
      // Defensive: even if a malicious prompt smuggled customerId into args
      // (the schema does not declare it, so Zod will strip it), the bound
      // ctx.customerId is what the service receives.
      await callExecute(tools.listMyTickets, {
        customerId: 'attacker-target',
      } as Record<string, unknown>);
      expect(spies.findByCustomer).toHaveBeenCalledWith('real-customer', 1, 20);
    });
  });

  describe('listMyTickets', () => {
    it('forwards page/limit defaults', async () => {
      const { services, spies } = makeMockServices();
      const tools = buildCustomerChatTools({
        customerId: 'cust-7',
        brandId: 'homtone',
        locale: 'en',
        ...services,
      });
      const result = (await callExecute(tools.listMyTickets, {})) as {
        ok: boolean;
        data: unknown;
      };
      expect(result.ok).toBe(true);
      expect(spies.findByCustomer).toHaveBeenCalledWith('cust-7', 1, 20);
    });
  });

  describe('createCustomerTicket', () => {
    it('returns the seeded ticket and locks customerId from ctx', async () => {
      const { services, spies } = makeMockServices();
      const tools = buildCustomerChatTools({
        customerId: 'cust-9',
        brandId: 'homtone',
        locale: 'en',
        ...services,
      });
      const result = (await callExecute(tools.createCustomerTicket, {
        subject: 'Damaged item',
        initialMessage: 'My package arrived broken',
        priority: 'high',
        tags: ['return-request'],
      })) as { ok: boolean; data: { ticketNo: string } };
      expect(result.ok).toBe(true);
      expect(result.data.ticketNo).toBe('HO-20260504-0001');
      expect(spies.create).toHaveBeenCalledWith({
        customerId: 'cust-9',
        subject: 'Damaged item',
        initialMessage: 'My package arrived broken',
        priority: 'high',
        tags: ['return-request'],
      });
    });
  });

  describe('error classification (ADR-012 §D3)', () => {
    it('translates NotFoundException → NOT_FOUND', async () => {
      const { services } = makeMockServices();
      (services.ticket.addMessage as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new NotFoundException('Ticket not found'),
      );
      const tools = buildCustomerChatTools({
        customerId: 'cust-1',
        brandId: 'homtone',
        locale: 'en',
        ...services,
      });
      const result = (await callExecute(tools.addCustomerTicketMessage, {
        ticketId: 't-missing',
        content: 'follow-up',
      })) as { ok: boolean; error: string };
      expect(result.ok).toBe(false);
      expect(result.error).toBe('NOT_FOUND');
    });

    it('translates ForbiddenException → FORBIDDEN', async () => {
      const { services } = makeMockServices();
      (services.ticket.addMessage as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ForbiddenException('Not your ticket'),
      );
      const tools = buildCustomerChatTools({
        customerId: 'cust-1',
        brandId: 'homtone',
        locale: 'en',
        ...services,
      });
      const result = (await callExecute(tools.addCustomerTicketMessage, {
        ticketId: 't-otherone',
        content: 'follow-up',
      })) as { ok: boolean; error: string };
      expect(result.ok).toBe(false);
      expect(result.error).toBe('FORBIDDEN');
    });

    it('translates BadRequestException → BAD_REQUEST', async () => {
      const { services } = makeMockServices();
      (services.ticket.addMessage as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new BadRequestException('TICKET_CLOSED'),
      );
      const tools = buildCustomerChatTools({
        customerId: 'cust-1',
        brandId: 'homtone',
        locale: 'en',
        ...services,
      });
      const result = (await callExecute(tools.addCustomerTicketMessage, {
        ticketId: 't-closed',
        content: 'follow-up',
      })) as { ok: boolean; error: string };
      expect(result.ok).toBe(false);
      expect(result.error).toBe('BAD_REQUEST');
    });

    it('translates unknown error → UNKNOWN_ERROR (does not throw)', async () => {
      const { services } = makeMockServices();
      (services.ticket.findByCustomer as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('connection reset'),
      );
      const tools = buildCustomerChatTools({
        customerId: 'cust-1',
        brandId: 'homtone',
        locale: 'en',
        ...services,
      });
      const result = (await callExecute(tools.listMyTickets, {})) as {
        ok: boolean;
        error: string;
        message: string;
      };
      expect(result.ok).toBe(false);
      expect(result.error).toBe('UNKNOWN_ERROR');
      expect(result.message).toBe('connection reset');
    });
  });

  describe('registerWarranty', () => {
    it('passes locale through and forces invoiceFollowUpRequired=true', async () => {
      const { services, spies } = makeMockServices();
      const tools = buildCustomerChatTools({
        customerId: 'cust-2',
        brandId: 'homtone',
        locale: 'es',
        ...services,
      });
      const result = (await callExecute(tools.registerWarranty, {
        productSku: 'SKU-1',
        serialNumber: 'SN-1',
        purchaseDate: '2026-04-01',
      })) as { ok: boolean; data: { invoiceFollowUpRequired: boolean } };
      expect(result.ok).toBe(true);
      expect(result.data.invoiceFollowUpRequired).toBe(true);
      expect(spies.register).toHaveBeenCalledWith(
        'cust-2',
        expect.objectContaining({ productSku: 'SKU-1' }),
        undefined,
        'es',
      );
    });
  });

  describe('customerOrderLookup', () => {
    it('routes to lookupForChatTool with bound customerId', async () => {
      const { services, spies } = makeMockServices();
      const tools = buildCustomerChatTools({
        customerId: 'cust-5',
        brandId: 'homtone',
        locale: 'en',
        ...services,
      });
      const result = (await callExecute(tools.customerOrderLookup, {
        orderNumber: 'ORD-123',
      })) as { ok: boolean; data: { found: boolean } };
      expect(result.ok).toBe(true);
      expect(result.data.found).toBe(true);
      expect(spies.lookupForChatTool).toHaveBeenCalledWith('cust-5', 'ORD-123');
    });

    it('refuses anonymous lookup', async () => {
      const tools = buildCustomerChatTools(makeCtx({ customerId: null }));
      const result = (await callExecute(tools.customerOrderLookup, {
        orderNumber: 'ORD-1',
      })) as { ok: boolean; error: string };
      expect(result.ok).toBe(false);
      expect(result.error).toBe('NOT_AUTHENTICATED');
    });
  });
});

describe('describeCustomerChatTools', () => {
  it('renders one bullet per tool in registration order', () => {
    const tools = buildCustomerChatTools(makeCtx());
    const summary = describeCustomerChatTools(tools);
    expect(summary.split('\n')).toHaveLength(8);
    expect(summary).toContain('- listMyTickets:');
    expect(summary).toContain('- createCustomerTicket:');
    expect(summary).toContain('- customerOrderLookup:');
    expect(summary).toContain('- listProductManuals:');
  });
});
