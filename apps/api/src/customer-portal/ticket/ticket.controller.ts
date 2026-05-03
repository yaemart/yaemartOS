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
import { IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ClsService } from 'nestjs-cls';
import { CustomerGuard } from '../customer-auth/customer.guard';
import { CustomerTenantGuard } from '../customer-tenant.guard';
import { FeatureFlagGuard, RequireFeatureFlag } from '../../common/feature-flag/feature-flag.guard';
import { TicketService, TicketPriority, TicketStatus } from './ticket.service';
import { RequirePolicy } from '../../iam/require-policy.decorator';

class CreateTicketDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  initialMessage!: string;

  @IsOptional()
  @IsIn(['low', 'normal', 'high', 'urgent'])
  priority?: TicketPriority;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

class AddMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;
}

class UpdateStatusDto {
  @IsIn(['open', 'in_progress', 'resolved', 'closed'])
  status!: TicketStatus;
}

class AssignDto {
  @IsUUID()
  assigneeId!: string;
}

@Controller('customer/tickets')
@UseGuards(CustomerTenantGuard, FeatureFlagGuard)
@RequireFeatureFlag('portal_ticket')
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
      priority: dto.priority,
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

  /**
   * Operator: assign ticket to an agent.
   *
   * @note Operator callers must supply the `x-yaemart-brand` header (required by
   * CustomerTenantGuard on this controller) to identify the brand schema.
   * TODO(tech-debt): Move operator endpoints to a dedicated OperatorTicketController
   * without CustomerTenantGuard to separate customer-facing and operator-facing routes.
   */
  @Patch(':ticketId/assign')
  @RequirePolicy({ obj: 'tickets', act: 'update', field: '*' })
  async assign(@Param('ticketId') ticketId: string, @Body() dto: AssignDto) {
    return this.ticketService.assign(ticketId, dto.assigneeId);
  }

  /**
   * Operator: update ticket status.
   * @note See assign() for the x-yaemart-brand header requirement.
   */
  @Patch(':ticketId/status')
  @RequirePolicy({ obj: 'tickets', act: 'update', field: '*' })
  async updateStatus(@Param('ticketId') ticketId: string, @Body() dto: UpdateStatusDto) {
    return this.ticketService.updateStatus({ ticketId, status: dto.status });
  }

  /**
   * Operator: add agent reply message.
   * @note See assign() for the x-yaemart-brand header requirement.
   */
  @Post(':ticketId/agent-messages')
  @HttpCode(HttpStatus.CREATED)
  @RequirePolicy({ obj: 'tickets', act: 'update', field: '*' })
  async addAgentMessage(@Param('ticketId') ticketId: string, @Body() dto: AddMessageDto) {
    return this.ticketService.addAgentMessage(ticketId, dto.content);
  }
}
