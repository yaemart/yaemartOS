import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ClsService } from 'nestjs-cls';
import { CustomerTenantGuard } from '../customer-tenant.guard';
import { ChatService } from './chat.service';
import { TicketService } from '../ticket/ticket.service';

interface CreateSessionDto {
  sessionToken?: string;
}

interface SendMessageDto {
  content: string;
  locale?: string;
}

@Controller('customer/chat')
@UseGuards(CustomerTenantGuard)
export class ChatController {
  constructor(
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
   */
  @Sse('sessions/:sessionId/stream')
  stream(@Param('sessionId') sessionId: string, @Req() req: Request): Observable<MessageEvent> {
    const subject = this.chatService.getSessionStream(sessionId);

    req.on('close', () => {
      this.chatService.removeSessionStream(sessionId);
    });

    return subject.pipe(
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
    const subject = this.chatService.getSessionStream(sessionId);
    if (!subject) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }
    return { sessionId, messages: [] };
  }
}
