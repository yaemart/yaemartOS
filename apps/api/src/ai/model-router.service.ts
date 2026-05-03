import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClientManager } from '../database/prisma.service';

export type AiTaskType = 'listing' | 'faq' | 'recipe' | 'extraction' | 'chat';
export type AiProviderType = 'gemini' | 'glm';

/**
 * Routes AI tasks to the appropriate provider based on taskType + locale.
 *
 * Priority (highest to lowest):
 *   1. DB: SystemConfig "ai_routing.{taskType}.{locale}"  — DB runtime override
 *   2. DB: SystemConfig "ai_routing.{taskType}"           — task-level DB default
 *   3. Env: AI_TASK_ROUTER_{TASK}_{LOCALE}                — env locale override
 *   4. Env: AI_TASK_ROUTER_{TASK}                         — env task default
 *   5. Hardcoded default routing table                    — safe fallback
 */
@Injectable()
export class ModelRouterService {
  private readonly logger = new Logger(ModelRouterService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prismaManager: PrismaClientManager,
  ) {}

  async getProviderType(taskType: AiTaskType, locale: string): Promise<AiProviderType> {
    const localeDbKey = `ai_routing.${taskType}.${locale.toLowerCase()}`;
    const localeDbValue = await this.getDbValue(localeDbKey);
    if (this.isValidProvider(localeDbValue)) {
      this.logger.debug(`Router DB override: ${localeDbKey}=${localeDbValue}`);
      return localeDbValue as AiProviderType;
    }

    const taskDbKey = `ai_routing.${taskType}`;
    const taskDbValue = await this.getDbValue(taskDbKey);
    if (this.isValidProvider(taskDbValue)) {
      this.logger.debug(`Router DB override: ${taskDbKey}=${taskDbValue}`);
      return taskDbValue as AiProviderType;
    }

    const envLocaleKey = `AI_TASK_ROUTER_${taskType.toUpperCase()}_${locale.toUpperCase()}`;
    const envLocaleValue = this.config.get<string>(envLocaleKey)?.toLowerCase();
    if (this.isValidProvider(envLocaleValue)) {
      this.logger.debug(`Router env override: ${envLocaleKey}=${envLocaleValue}`);
      return envLocaleValue as AiProviderType;
    }

    const envTaskKey = `AI_TASK_ROUTER_${taskType.toUpperCase()}`;
    const envTaskValue = this.config.get<string>(envTaskKey)?.toLowerCase();
    if (this.isValidProvider(envTaskValue)) {
      this.logger.debug(`Router env override: ${envTaskKey}=${envTaskValue}`);
      return envTaskValue as AiProviderType;
    }

    return this.defaultRoute(taskType);
  }

  /** Synchronous route lookup (env-only, no DB). Use only when async isn't viable. */
  getProviderTypeSync(taskType: AiTaskType, locale: string): AiProviderType {
    const envLocaleKey = `AI_TASK_ROUTER_${taskType.toUpperCase()}_${locale.toUpperCase()}`;
    const envLocale = this.config.get<string>(envLocaleKey)?.toLowerCase();
    if (this.isValidProvider(envLocale)) {
      return envLocale as AiProviderType;
    }

    const envTaskKey = `AI_TASK_ROUTER_${taskType.toUpperCase()}`;
    const envTask = this.config.get<string>(envTaskKey)?.toLowerCase();
    if (this.isValidProvider(envTask)) {
      return envTask as AiProviderType;
    }

    return this.defaultRoute(taskType);
  }

  private defaultRoute(taskType: AiTaskType): AiProviderType {
    switch (taskType) {
      case 'faq':
      case 'recipe':
        return 'glm';
      case 'listing':
      case 'extraction':
      case 'chat':
        return 'gemini';
      default: {
        const _exhaustive: never = taskType;
        this.logger.warn(`Unknown taskType "${_exhaustive as string}" — falling back to gemini`);
        return 'gemini';
      }
    }
  }

  private isValidProvider(value: string | null | undefined): value is AiProviderType {
    return value === 'gemini' || value === 'glm';
  }

  private async getDbValue(key: string): Promise<string | null> {
    try {
      const row = await this.prismaManager
        .getPublicClient()
        .systemConfig.findUnique({ where: { key }, select: { value: true } });
      return row?.value ?? null;
    } catch {
      return null;
    }
  }
}
