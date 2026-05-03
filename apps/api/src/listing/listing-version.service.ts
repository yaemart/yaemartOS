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
    @Optional() private readonly draftIndexer?: ListingDraftIndexerService,
  ) {}

  private get prisma() {
    return this.prismaManager.getPublicClient();
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
