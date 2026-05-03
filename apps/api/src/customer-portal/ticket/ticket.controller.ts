import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { CustomerGuard } from '../customer-auth/customer.guard';
import { CustomerTenantGuard } from '../customer-tenant.guard';
import { TicketService, TicketStatus } from './ticket.service';
import { RequirePolicy } from '../../iam/require-policy.decorator';

interface CreateTicketDto {
  subject: string;
  initialMessage: string;
  priority?: string;
  tags?: string[];
}

interface AddMessageDto {
  content: string;
}

interface UpdateStatusDto {
  status: TicketStatus;
}

interface AssignDto {
  assigneeId: string;
}

@Controller('customer/tickets')
@UseGuards(CustomerTenantGuard)
export class TicketController {
  constructor(
    private readonly ticketService: TicketService,
    private readonly cls: ClsService,
  ) {}

  /** Customer: create a new ticket (requires login). */
  @Post()
  @UseGuards(CustomerGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateTicketDto) {
    const customerId = this.cls.get<string>('customerId');
    return this.ticketService.create({
      customerId,
      subject: dto.subject,
      initialMessage: dto.initialMessage,
      priority: dto.priority as any,
      tags: dto.tags,
    });
  }

  /** Customer: list own tickets (requires login). */
  @Get()
  @UseGuards(CustomerGuard)
  async findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    const customerId = this.cls.get<string>('customerId');
    return this.ticketService.findByCustomer(
      customerId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /** Customer: get message thread for a ticket (requires login). */
  @Get(':ticketId/messages')
  @UseGuards(CustomerGuard)
  async getMessages(@Param('ticketId') ticketId: string) {
    const customerId = this.cls.get<string>('customerId');
    return this.ticketService.findMessages(ticketId, customerId);
  }

  /** Customer: add message to a ticket (requires login). */
  @Post(':ticketId/messages')
  @UseGuards(CustomerGuard)
  @HttpCode(HttpStatus.CREATED)
  async addMessage(@Param('ticketId') ticketId: string, @Body() dto: AddMessageDto) {
    const customerId = this.cls.get<string>('customerId');
    return this.ticketService.addMessage({
      ticketId,
      customerId,
      content: dto.content,
    });
  }

  /** Customer: close own ticket. */
  @Patch(':ticketId/close')
  @UseGuards(CustomerGuard)
  async close(@Param('ticketId') ticketId: string) {
    const customerId = this.cls.get<string>('customerId');
    return this.ticketService.closeByCustomer(ticketId, customerId);
  }

  /** Operator: assign ticket to an agent. */
  @Patch(':ticketId/assign')
  @RequirePolicy({ obj: 'tickets', act: 'update', field: '*' })
  async assign(@Param('ticketId') ticketId: string, @Body() dto: AssignDto) {
    return this.ticketService.assign(ticketId, dto.assigneeId);
  }

  /** Operator: update ticket status. */
  @Patch(':ticketId/status')
  @RequirePolicy({ obj: 'tickets', act: 'update', field: '*' })
  async updateStatus(@Param('ticketId') ticketId: string, @Body() dto: UpdateStatusDto) {
    return this.ticketService.updateStatus({ ticketId, status: dto.status });
  }

  /** Operator: add agent reply message. */
  @Post(':ticketId/agent-messages')
  @HttpCode(HttpStatus.CREATED)
  @RequirePolicy({ obj: 'tickets', act: 'update', field: '*' })
  async addAgentMessage(@Param('ticketId') ticketId: string, @Body() dto: AddMessageDto) {
    return this.ticketService.addAgentMessage(ticketId, dto.content);
  }
}
