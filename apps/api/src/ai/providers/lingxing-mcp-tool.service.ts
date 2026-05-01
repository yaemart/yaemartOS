import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  LingxingMcpBridge,
  type MappedInventory,
  type MappedListing,
} from '@yaemartos/lingxing-client';
import { AuditService } from '../../common/audit/audit.service';
import type { IMcpToolCallService } from '../interfaces/mcp-tool-call.interface';

function hashPayload(value: unknown): string {
  return createHash('md5').update(JSON.stringify(value)).digest('hex');
}

@Injectable()
export class LingxingMcpToolService implements IMcpToolCallService {
  private readonly logger = new Logger(LingxingMcpToolService.name);

  constructor(
    private readonly bridge: LingxingMcpBridge,
    private readonly audit: AuditService,
  ) {}

  async ping(): Promise<'ok'> {
    return 'ok';
  }

  async queryInventory(params: {
    shopId: string;
    marketplaceId: string;
  }): Promise<MappedInventory[]> {
    return this.withAudit('queryInventory', params, () => this.bridge.queryInventory(params));
  }

  async getListingSummary(params: {
    asin: string;
    shopId?: string;
  }): Promise<MappedListing | null> {
    return this.withAudit('getListingSummary', params, () => this.bridge.getListingSummary(params));
  }

  async getKeywordSuggestions(params: { asin: string }): Promise<string[]> {
    return this.withAudit('getKeywordSuggestions', params, () =>
      this.bridge.getKeywordSuggestions(params),
    );
  }

  private async withAudit<T>(operation: string, params: unknown, fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    const paramsHash = hashPayload(params);
    let statusCode = 'ok';
    let result: T;

    try {
      result = await fn();
      statusCode = 'ok';
    } catch (err) {
      statusCode = (err as { code?: string })?.code ?? 'UNKNOWN_ERROR';
      this.audit
        .logWrite({
          action: operation,
          entity: 'mcp_tool_call',
          metadata: {
            paramsHash,
            resultHash: null,
            elapsedMs: Date.now() - startTime,
            statusCode,
          },
        })
        .catch((auditErr) => this.logger.warn('MCP audit log failed', auditErr));
      throw err;
    }

    this.audit
      .logWrite({
        action: operation,
        entity: 'mcp_tool_call',
        metadata: {
          paramsHash,
          resultHash: hashPayload(result),
          elapsedMs: Date.now() - startTime,
          statusCode,
        },
      })
      .catch((auditErr) => this.logger.warn('MCP audit log failed', auditErr));

    return result;
  }
}
