import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocaleCode, ProductContentSource } from '../../generated/prisma';
import { PrismaClientManager } from '../../database/prisma.service';
import { CostTrackingService } from '../cost-tracking.service';
import { GlmGenerationService } from './glm-generation.service';

type FaqItem = {
  question: string;
  answer: string;
};

type FaqPayload = {
  faqs: FaqItem[];
  generatedAt: string;
  model: string;
};

const FAQ_SYSTEM_PROMPT = `You are an expert e-commerce product FAQ writer. 
Given product information, generate 3-5 clear and helpful FAQ items in the format:
Q: <question>
A: <answer>

Each Q/A pair should address common customer concerns about the product.
Keep answers concise and informative (2-3 sentences max).`;

@Injectable()
export class FaqGenerationService {
  private readonly logger = new Logger(FaqGenerationService.name);

  constructor(
    private readonly prismaManager: PrismaClientManager,
    private readonly glm: GlmGenerationService,
    private readonly costTracking: CostTrackingService,
    private readonly config: ConfigService,
  ) {}

  async generateFaq(productId: string, locale: string): Promise<FaqPayload> {
    const prisma = this.prismaManager.getPublicClient();

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        brand: { select: { name: true, slug: true } },
        category: { select: { name: true, slug: true } },
        contents: {
          where: { locale: LocaleCode.en },
          take: 1,
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product not found: ${productId}`);
    }

    const brandName = product.brand?.name ?? 'Unknown Brand';
    const categoryName = product.category?.name ?? 'General';
    const existingContent = product.contents[0];
    const contentPayload = existingContent?.payload as Record<string, unknown> | null;

    const productInfo = [
      `Product: ${product.title}`,
      `SKU: ${product.sku}`,
      `Brand: ${brandName}`,
      `Category: ${categoryName}`,
      ...(contentPayload?.description
        ? [`Description: ${String(contentPayload.description).slice(0, 500)}`]
        : []),
      ...(contentPayload?.bullets && Array.isArray(contentPayload.bullets)
        ? [`Key features: ${(contentPayload.bullets as string[]).slice(0, 3).join('; ')}`]
        : []),
    ].join('\n');

    const prompt = `${FAQ_SYSTEM_PROMPT}\n\nProduct Information:\n${productInfo}\n\nLanguage: ${locale}\n\nGenerate FAQs now:`;

    this.logger.log(`Generating FAQ for product=${productId} locale=${locale}`);

    const start = Date.now();
    let rawText: string;
    try {
      rawText = await this.glm.generateText(prompt);
    } catch (err) {
      this.logger.error(`GLM FAQ generation failed for product=${productId}`, err);
      throw new ServiceUnavailableException('FAQ generation service is temporarily unavailable');
    }
    const durationMs = Date.now() - start;

    const glmModel = this.config.get<string>('GLM_MODEL') ?? 'glm-4-flash';

    void this.costTracking.record({
      model: glmModel,
      taskType: 'faq',
      brandId: product.brand?.slug,
      promptTokens: Math.ceil(prompt.length / 4),
      completionTokens: Math.ceil(rawText.length / 4),
      durationMs,
    });

    const faqs = this.parseFaqs(rawText);

    const payload: FaqPayload = {
      faqs,
      generatedAt: new Date().toISOString(),
      model: glmModel,
    };

    const localeCode = (
      locale.toLowerCase() in LocaleCode ? (locale.toLowerCase() as LocaleCode) : LocaleCode.en
    ) as LocaleCode;

    const jsonPayload = payload as any;
    await prisma.productContent.upsert({
      where: {
        productId_locale_source: {
          productId,
          locale: localeCode,
          source: ProductContentSource.ai_generated,
        },
      },
      create: {
        productId,
        locale: localeCode,
        source: ProductContentSource.ai_generated,
        payload: jsonPayload,
      },
      update: {
        payload: jsonPayload,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`FAQ upserted for product=${productId} locale=${locale} count=${faqs.length}`);
    return payload;
  }

  private parseFaqs(text: string): FaqItem[] {
    const faqs: FaqItem[] = [];
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    let currentQuestion: string | null = null;
    let currentAnswer: string[] = [];

    for (const line of lines) {
      if (line.startsWith('Q:') || line.match(/^\d+\.\s*Q:/)) {
        if (currentQuestion && currentAnswer.length > 0) {
          faqs.push({ question: currentQuestion, answer: currentAnswer.join(' ') });
        }
        currentQuestion = line.replace(/^(\d+\.\s*)?Q:\s*/, '').trim();
        currentAnswer = [];
      } else if (line.startsWith('A:') && currentQuestion) {
        currentAnswer = [line.replace(/^A:\s*/, '').trim()];
      } else if (currentQuestion && currentAnswer.length > 0 && !line.startsWith('Q:')) {
        currentAnswer.push(line);
      }
    }

    if (currentQuestion && currentAnswer.length > 0) {
      faqs.push({ question: currentQuestion, answer: currentAnswer.join(' ') });
    }

    return faqs.slice(0, 5);
  }
}
