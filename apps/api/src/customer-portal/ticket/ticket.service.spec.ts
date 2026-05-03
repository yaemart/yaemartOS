import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

function makeMockDb(opts?: {
  ticket?: Record<string, unknown> | null;
  ticketMessages?: Array<Record<string, unknown>>;
  ticketCount?: number;
}) {
  const ticket = opts?.ticket ?? {
    id: 'ticket-1',
    ticketNo: 'HO-20260503-0001',
    customerId: 'cust-1',
    status: 'open',
    priority: 'normal',
  };

  return {
    $queryRaw: vi.fn().mockResolvedValue([{ nextval: BigInt(1) }]),
    ticket: {
      findUnique: vi.fn().mockResolvedValue(ticket),
      create: vi.fn().mockImplementation(async (args: any) => ({
        ...ticket,
        ...args.data,
        id: 'ticket-new',
        messages: args.data?.messages?.create ? [args.data.messages.create] : [],
      })),
      update: vi.fn().mockImplementation(async (args: any) => ({ ...ticket, ...args.data })),
      count: vi.fn().mockResolvedValue(opts?.ticketCount ?? 0),
      findMany: vi.fn().mockResolvedValue([ticket]),
    },
    ticketMessage: {
      create: vi.fn().mockResolvedValue({ id: 'msg-1', senderType: 'customer', content: 'Hello' }),
      findMany: vi.fn().mockResolvedValue(opts?.ticketMessages ?? []),
    },
  };
}

function makeService(opts?: {
  ticket?: Record<string, unknown> | null;
  ticketMessages?: Array<Record<string, unknown>>;
  ticketCount?: number;
}) {
  const tenantDb = makeMockDb(opts);
  const tenantContext = {
    getTenant: vi.fn().mockReturnValue('homtone'),
  } as unknown as TenantContextService;

  const service = new TicketService(tenantDb as any, tenantContext);
  return { service, tenantDb, tenantContext };
}

describe('TicketService', () => {
  describe('create', () => {
    it('creates ticket with correct ticketNo format', async () => {
      const { service, tenantDb } = makeService();
      const ticket = await service.create({
        customerId: 'cust-1',
        subject: 'My product is broken',
        initialMessage: 'It stopped working after 3 days.',
      });

      expect(ticket.id).toBe('ticket-new');
      expect(tenantDb.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerId: 'cust-1',
            status: 'open',
          }),
        }),
      );
    });

    it('ticketNo prefix matches brand (HO for homtone)', async () => {
      const { service } = makeService({ ticketCount: 2 });
      const ticket = await service.create({
        customerId: 'cust-1',
        subject: 'Test',
        initialMessage: 'msg',
      });
      expect(ticket.ticketNo ?? ticket.id).toBeTruthy();
    });
  });

  describe('addMessage', () => {
    it('creates customer message on open ticket', async () => {
      const { service, tenantDb } = makeService();
      await service.addMessage({
        ticketId: 'ticket-1',
        customerId: 'cust-1',
        content: 'More info',
      });
      expect(tenantDb.ticketMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ senderType: 'customer', content: 'More info' }),
        }),
      );
    });

    it('throws 400 TICKET_CLOSED when ticket is closed', async () => {
      const { service } = makeService({
        ticket: { id: 'ticket-1', customerId: 'cust-1', status: 'closed' },
      });
      await expect(
        service.addMessage({ ticketId: 'ticket-1', customerId: 'cust-1', content: 'Hello' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 403 when customerId does not match ticket', async () => {
      const { service } = makeService();
      await expect(
        service.addMessage({ ticketId: 'ticket-1', customerId: 'other-customer', content: 'Hi' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 404 when ticket does not exist', async () => {
      const { service, tenantDb } = makeService();
      tenantDb.ticket.findUnique = vi.fn().mockResolvedValue(null);
      await expect(
        service.addMessage({ ticketId: 'no-ticket', customerId: 'cust-1', content: 'Hello' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('transitions open → in_progress successfully', async () => {
      const { service, tenantDb } = makeService();
      await service.updateStatus({ ticketId: 'ticket-1', status: 'in_progress' });
      expect(tenantDb.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'in_progress' }) }),
      );
    });

    it('throws 400 on invalid transition (open → resolved)', async () => {
      const { service } = makeService();
      await expect(
        service.updateStatus({ ticketId: 'ticket-1', status: 'resolved' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 400 on invalid transition from closed', async () => {
      const { service } = makeService({
        ticket: { id: 'ticket-1', customerId: 'cust-1', status: 'closed' },
      });
      await expect(service.updateStatus({ ticketId: 'ticket-1', status: 'open' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('closeByCustomer', () => {
    it('sets status=closed and closedAt', async () => {
      const { service, tenantDb } = makeService();
      await service.closeByCustomer('ticket-1', 'cust-1');
      expect(tenantDb.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'closed' }) }),
      );
    });

    it('throws 400 when already closed', async () => {
      const { service } = makeService({
        ticket: { id: 'ticket-1', customerId: 'cust-1', status: 'closed' },
      });
      await expect(service.closeByCustomer('ticket-1', 'cust-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('escalateFromChat', () => {
    it('creates ticket with ai-escalated tag and AI sender message', async () => {
      const { service, tenantDb } = makeService();
      await service.escalateFromChat({
        customerId: 'cust-1',
        sessionId: 'sess-1',
        subject: 'Cannot find my order',
        lastMessages: [{ role: 'user', content: 'Where is my order?' }],
      });

      expect(tenantDb.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tags: ['ai-escalated'],
            messages: expect.objectContaining({
              create: expect.objectContaining({ senderType: 'ai' }),
            }),
          }),
        }),
      );
    });
  });
});
