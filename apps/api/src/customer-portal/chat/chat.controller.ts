import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ClsService } from 'nestjs-cls';
import { PRISMA_TENANT_CLIENT } from '../../database/database.tokens';
import { TenantPrismaClient } from '../../database/tenant-prisma.types';
import { FeatureFlagGuard, RequireFeatureFlag } from '../../common/feature-flag/feature-flag.guard';
import { CustomerTenantGuard } from '../customer-tenant.guard';
import { ChatService } from './chat.service';
import { TicketService } from '../ticket/ticket.service';

class CreateSessionDto {
  @IsOptional()
  @IsString()
  sessionToken?: string;
}

class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;

  @IsOptional()
  @IsString()
  locale?: string;
}

@Controller('customer/chat')
@UseGuards(CustomerTenantGuard, FeatureFlagGuard)
@RequireFeatureFlag('portal_chat')
export class ChatController {
  constructor(
    @Inject(PRISMA_TENANT_CLIENT) private readonly tenantDb: TenantPrismaClient,
    private readonly chatService: ChatService,
    private readonly ticketService: TicketService,
    private readonly cls: ClsService,
  ) {}

  /**
   * Creates or resumes a chat session.
   * Anonymous: pass sessionToken from cookie.
   * Authenticated: customerId from CLS (set by CustomerGuard if present).
   */
  @Post('sessions')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async getOrCreateSession(@Body() dto: CreateSessionDto, @Req() req: Request) {
    const customerId = this.cls.get<string | undefined>('customerId');
    const brandId = this.cls.get<string>('tenantId');
    const existingToken =
      dto.sessionToken ?? (req.cookies as Record<string, string>)?.['chat_session'] ?? undefined;

    const result = await this.chatService.getOrCreateSession({
      customerId,
      brandId,
      existingSessionToken: existingToken,
    });

    return result;
  }

  /**
   * Sends a message to the AI assistant.
   * Triggers async AI processing; the response tokens are pushed to the SSE stream.
   */
  @Post('sessions/:sessionId/messages')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async sendMessage(
    @Param('sessionId') sessionId: string,
    @Body() dto: SendMessageDto,
    @Res({ passthrough: true }) _res: Response,
  ) {
    const brandId = this.cls.get<string>('tenantId');
    const locale = dto.locale ?? 'en';

    this.chatService
      .handleMessage({
        sessionId,
        brandId,
        locale,
        content: dto.content,
        onEscalate: async (lastMessages) => {
          const customerId = this.cls.get<string | undefined>('customerId');
          if (!customerId) {
            return;
          }
          await this.ticketService
            .escalateFromChat({
              customerId,
              sessionId,
              subject: dto.content.slice(0, 100),
              lastMessages,
            })
            .catch((err: Error) => {
              // Escalation failure must not block the streaming response
              console.error(`Ticket escalation failed for session ${sessionId}: ${err.message}`);
            });
        },
      })
      .catch((err: Error) => {
        console.error(`handleMessage error for session ${sessionId}: ${err.message}`);
      });

    return { sessionId, status: 'processing' };
  }

  /**
   * SSE endpoint — streams AI response tokens for the given session.
   * The client should open this connection before sending a message.
   * Validates DB ownership before creating the Subject to prevent DoS.
   */
  @Sse('sessions/:sessionId/stream')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  stream(@Param('sessionId') sessionId: string, @Req() req: Request): Observable<MessageEvent> {
    const tenantId = this.cls.get<string>('tenantId');
    const customerId = this.cls.get<string | undefined>('customerId');

    return from(this.chatService.validateSession(tenantId, sessionId, customerId)).pipe(
      switchMap(() => {
        const subject = this.chatService.getSessionStream(tenantId, sessionId);
        req.on('close', () => {
          this.chatService.removeSessionStream(tenantId, sessionId);
        });
        return subject;
      }),
      map((event) => {
        return new MessageEvent(event.escalated ? 'escalated' : 'message', {
          data: JSON.stringify(event),
        });
      }),
    );
  }

  /**
   * Returns recent messages for a session (for UI hydration on reconnect).
   */
  @Get('sessions/:sessionId/messages')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getMessages(@Param('sessionId') sessionId: string) {
    const tenantId = this.cls.get<string>('tenantId');
    const customerId = this.cls.get<string | undefined>('customerId');

    await this.chatService.validateSession(tenantId, sessionId, customerId);

    const session = await this.tenantDb.chatSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    const messages = await this.tenantDb.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, content: true, createdAt: true },
    });

    return { sessionId, messages };
  }
}
