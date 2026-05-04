import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ListingVersionStatus, Prisma } from '../generated/prisma';
import { AuditService } from '../common/audit/audit.service';
import { PrismaClientManager } from '../database/prisma.service';
import { ListingDraftIndexerService } from '../search/listing-draft-indexer.service';
import { RealtimeBusService } from '../realtime/realtime-bus.service';
import type { ListingContent } from '@yaemartos/shared-types';

type Actor = {
  id?: string;
  brandId?: string;
};

@Injectable()
export class ListingVersionService {
  private readonly logger = new Logger(ListingVersionService.name);

  constructor(
    private readonly prismaManager: PrismaClientManager,
    private readonly auditService: AuditService,
    private readonly realtimeBus: RealtimeBusService,
    @Optional() private readonly draftIndexer?: ListingDraftIndexerService,
  ) {}

  private get prisma() {
    return this.prismaManager.getPublicClient();
  }

  private async getListingBrandId(listingId: string): Promise<string | null> {
    const row = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { brandId: true },
    });
    return row?.brandId ?? null;
  }

  async listVersions(listingId: string) {
    await this.assertListingExists(listingId);
    return this.prisma.listingVersion.findMany({
      where: { listingId },
      orderBy: { versionNumber: 'desc' },
    });
  }

  /**
   * AI-only entry point: always writes a draft version.
   * Use this from generation services to make the draft-only constraint explicit.
   */
  createDraftVersion(listingId: string, content: ListingContent, actor?: Actor) {
    return this.createVersion(listingId, content, actor, 'draft');
  }

  /**
   * Creates a new version for a listing (always status=draft for AI-generated content;
   * status=active is only set via activate()).
   */
  async createVersion(
    listingId: string,
    content: ListingContent,
    actor?: Actor,
    status: 'draft' | 'active' = 'draft',
  ) {
    await this.assertListingExists(listingId);

    const version = await this.prisma.$transaction(async (tx) => {
      const last = await tx.listingVersion.findFirst({
        where: { listingId },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      });

      const nextNumber = (last?.versionNumber ?? 0) + 1;

      if (status === 'active') {
        await this.archiveActiveVersions(tx, listingId);
      }

      return tx.listingVersion.create({
        data: {
          listingId,
          versionNumber: nextNumber,
          contentSnapshot: content as unknown as Prisma.InputJsonValue,
          status: status === 'active' ? ListingVersionStatus.active : ListingVersionStatus.draft,
          createdBy: actor?.id ?? null,
        },
      });
    });

    await this.auditService.logWrite({
      userId: actor?.id,
      tenant: actor?.brandId,
      action: 'listing.version.create',
      entity: 'ListingVersion',
      entityId: version.id,
      metadata: { listingId, versionNumber: version.versionNumber, status: version.status },
    });

    // Fire-and-forget: keep ES index in sync with the DB version
    void this.draftIndexer
      ?.indexVersion(version.id)
      .catch((err: unknown) =>
        this.logger.warn(`Draft index failed for version ${version.id}: ${String(err)}`),
      );

    // Realtime fanout: notify any open editor for this listing that a new
    // version exists. We resolve brandId lazily — if the listing was deleted
    // in a race, brandId will be null and we skip publication.
    //
    // ids carries both versionId and listingId so editor pages subscribing
    // with `filterIds: [listingId]` catch the event without needing extra
    // metadata filtering on the client.
    const brandId = actor?.brandId ?? (await this.getListingBrandId(listingId));
    if (brandId) {
      void this.realtimeBus.publish({
        entity: 'listing-version',
        action: 'create',
        brandId,
        ids: [version.id, listingId],
        actorType: actor?.id ? 'user' : 'agent',
        actorId: actor?.id,
        timestamp: Date.now(),
        metadata: {
          listingId,
          versionNumber: version.versionNumber,
          status: version.status,
        },
      });
    }

    return version;
  }

  /**
   * Activates a specific version by number.
   * Archives the currently active version (if any) within the same transaction.
   * Only operators with explicit permission can activate (IAM enforced at controller level).
   */
  async activateVersion(listingId: string, versionNumber: number, actor?: Actor) {
    await this.assertListingExists(listingId);

    const target = await this.prisma.listingVersion.findUnique({
      where: { listingId_versionNumber: { listingId, versionNumber } },
    });

    if (!target) {
      throw new NotFoundException(`Version ${versionNumber} not found for listing ${listingId}`);
    }

    if (target.status === ListingVersionStatus.active) {
      throw new BadRequestException(`Version ${versionNumber} is already active`);
    }

    const activated = await this.prisma.$transaction(async (tx) => {
      await this.archiveActiveVersions(tx, listingId);

      return tx.listingVersion.update({
        where: { id: target.id },
        data: {
          status: ListingVersionStatus.active,
          publishedAt: new Date(),
        },
      });
    });

    await this.auditService.logWrite({
      userId: actor?.id,
      tenant: actor?.brandId,
      action: 'listing.version.activate',
      entity: 'ListingVersion',
      entityId: activated.id,
      metadata: { listingId, versionNumber, previousStatus: target.status },
    });

    // Re-index on activate so status change is reflected in ES
    void this.draftIndexer
      ?.indexVersion(activated.id)
      .catch((err: unknown) =>
        this.logger.warn(
          `Draft index failed on activate for version ${activated.id}: ${String(err)}`,
        ),
      );

    // Realtime fanout: editor cards / version timeline / dashboards rely on
    // this to refresh after an activate. We publish two events because
    // activation logically mutates both the version row and the parent
    // listing's "active version" pointer; consumers may subscribe to either.
    const brandId = actor?.brandId ?? (await this.getListingBrandId(listingId));
    if (brandId) {
      const ts = Date.now();
      const actorType = actor?.id ? 'user' : 'agent';
      void this.realtimeBus.publish({
        entity: 'listing-version',
        action: 'update',
        brandId,
        ids: [activated.id, listingId],
        actorType,
        actorId: actor?.id,
        timestamp: ts,
        metadata: { listingId, versionNumber, action: 'activate' },
      });
      void this.realtimeBus.publish({
        entity: 'listing',
        action: 'update',
        brandId,
        ids: [listingId],
        actorType,
        actorId: actor?.id,
        timestamp: ts,
        metadata: { activeVersionId: activated.id, versionNumber },
      });
    }

    return activated;
  }

  private async archiveActiveVersions(tx: Prisma.TransactionClient, listingId: string) {
    await tx.listingVersion.updateMany({
      where: { listingId, status: ListingVersionStatus.active },
      data: { status: ListingVersionStatus.archived },
    });
  }

  private async assertListingExists(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true },
    });
    if (!listing) {
      throw new NotFoundException(`Listing not found: ${listingId}`);
    }
  }
}
