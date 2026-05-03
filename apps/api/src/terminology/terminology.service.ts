import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LocaleCode } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTerminologyDto } from './dto/create-terminology.dto';
import { UpdateTerminologyDto } from './dto/update-terminology.dto';

export interface CsvImportResult {
  imported: number;
  skipped: number;
}

@Injectable()
export class TerminologyService {
  constructor(private readonly prisma: PrismaService) {}

  async findByBrandAndLocale(brandId: string, locale: LocaleCode) {
    return this.prisma.terminologyEntry.findMany({
      where: { brandId, locale },
      orderBy: [{ category: 'asc' }, { term: 'asc' }],
    });
  }

  async create(dto: CreateTerminologyDto) {
    const existing = await this.prisma.terminologyEntry.findUnique({
      where: {
        brandId_locale_term: { brandId: dto.brandId, locale: dto.locale, term: dto.term },
      },
    });
    if (existing) {
      throw new ConflictException(
        `Term "${dto.term}" already exists for brand ${dto.brandId} locale ${dto.locale}`,
      );
    }
    return this.prisma.terminologyEntry.create({ data: dto });
  }

  async update(id: string, dto: UpdateTerminologyDto) {
    const entry = await this.prisma.terminologyEntry.findUnique({ where: { id } });
    if (!entry) {
      throw new NotFoundException(`TerminologyEntry ${id} not found`);
    }
    return this.prisma.terminologyEntry.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const entry = await this.prisma.terminologyEntry.findUnique({ where: { id } });
    if (!entry) {
      throw new NotFoundException(`TerminologyEntry ${id} not found`);
    }
    return this.prisma.terminologyEntry.delete({ where: { id } });
  }

  /**
   * Parses a CSV buffer with header row `term,definition,example`.
   * Rows with empty term are skipped. Duplicate (brandId, locale, term) entries
   * are upserted (definition/example updated).
   */
  async importCsv(
    brandId: string,
    locale: LocaleCode,
    fileBuffer: Buffer,
  ): Promise<CsvImportResult> {
    const text = fileBuffer.toString('utf-8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) {
      return { imported: 0, skipped: 0 };
    }

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const termIdx = header.indexOf('term');
    const defIdx = header.indexOf('definition');
    const exIdx = header.indexOf('example');

    if (termIdx === -1 || defIdx === -1) {
      throw new BadRequestException('CSV must have "term" and "definition" columns');
    }

    let imported = 0;
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      const term = cols[termIdx];
      const definition = cols[defIdx];
      if (!term) {
        skipped++;
        continue;
      }
      await this.prisma.terminologyEntry.upsert({
        where: {
          brandId_locale_term: { brandId, locale, term },
        },
        create: {
          brandId,
          locale,
          term,
          definition: definition ?? '',
          example: exIdx !== -1 ? cols[exIdx] || undefined : undefined,
        },
        update: {
          definition: definition ?? '',
          example: exIdx !== -1 ? cols[exIdx] || undefined : undefined,
        },
      });
      imported++;
    }

    return { imported, skipped };
  }
}
