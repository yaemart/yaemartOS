import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LingxingMcpToolService } from './lingxing-mcp-tool.service';
import { BusinessError, LingxingErrorCode } from '@yaemartos/lingxing-client';

function createService() {
  const bridge = {
    queryInventory: vi.fn(),
    getListingSummary: vi.fn(),
    getKeywordSuggestions: vi.fn(),
  } as any;

  const auditService = {
    logWrite: vi.fn().mockResolvedValue(undefined),
  } as any;

  const service = new LingxingMcpToolService(bridge, auditService);
  return { service, bridge, auditService };
}

describe('LingxingMcpToolService', () => {
  let service: LingxingMcpToolService;
  let bridge: ReturnType<typeof createService>['bridge'];
  let auditService: ReturnType<typeof createService>['auditService'];

  beforeEach(() => {
    vi.restoreAllMocks();
    ({ service, bridge, auditService } = createService());
  });

  it('ping returns ok', async () => {
    expect(await service.ping()).toBe('ok');
  });

  it('queryInventory calls bridge and logs audit', async () => {
    const mockResult = [{ sku: 'HT-SC-001', fbaAvailable: 100 }];
    bridge.queryInventory.mockResolvedValue(mockResult);

    const result = await service.queryInventory({
      shopId: 'shop-1',
      marketplaceId: 'ATVPDKIKX0DER',
    });

    expect(result).toEqual(mockResult);
    expect(bridge.queryInventory).toHaveBeenCalledWith({
      shopId: 'shop-1',
      marketplaceId: 'ATVPDKIKX0DER',
    });
    expect(auditService.logWrite).toHaveBeenCalledOnce();
    const auditCall = auditService.logWrite.mock.calls[0][0];
    expect(auditCall.action).toBe('queryInventory');
    expect(auditCall.entity).toBe('mcp_tool_call');
    expect(auditCall.metadata).toMatchObject({ statusCode: 'ok', paramsHash: expect.any(String) });
  });

  it('getListingSummary calls bridge and logs audit', async () => {
    const mockListing = { platformListingId: 'B09XYZ1234', sku: 'HT-SC-001' };
    bridge.getListingSummary.mockResolvedValue(mockListing);

    const result = await service.getListingSummary({ asin: 'B09XYZ1234' });

    expect(result).toEqual(mockListing);
    expect(auditService.logWrite).toHaveBeenCalledOnce();
  });

  it('getKeywordSuggestions calls bridge and logs audit', async () => {
    bridge.getKeywordSuggestions.mockResolvedValue(['slow cooker', 'programmable']);

    const result = await service.getKeywordSuggestions({ asin: 'B09XYZ1234' });

    expect(result).toEqual(['slow cooker', 'programmable']);
    expect(auditService.logWrite).toHaveBeenCalledOnce();
  });

  it('rethrows BusinessError and logs audit with error statusCode', async () => {
    const error = new BusinessError('shopId not in allowed list');
    bridge.queryInventory.mockRejectedValue(error);

    await expect(
      service.queryInventory({ shopId: 'forbidden', marketplaceId: 'ATVPDKIKX0DER' }),
    ).rejects.toThrow(BusinessError);

    expect(auditService.logWrite).toHaveBeenCalledOnce();
    const auditCall = auditService.logWrite.mock.calls[0][0];
    expect(auditCall.metadata.statusCode).toBe(LingxingErrorCode.API_ERROR);
  });

  it('audit log failure does not block tool result', async () => {
    bridge.getKeywordSuggestions.mockResolvedValue(['keyword-1']);
    auditService.logWrite.mockRejectedValue(new Error('DB down'));

    const result = await service.getKeywordSuggestions({ asin: 'B09XYZ1234' });
    expect(result).toEqual(['keyword-1']);
  });

  it('audit metadata contains paramsHash and elapsedMs', async () => {
    bridge.getListingSummary.mockResolvedValue(null);

    await service.getListingSummary({ asin: 'B09XYZ1234' });

    const metadata = auditService.logWrite.mock.calls[0][0].metadata;
    expect(metadata.paramsHash).toMatch(/^[a-f0-9]{32}$/);
    expect(typeof metadata.elapsedMs).toBe('number');
  });
});
