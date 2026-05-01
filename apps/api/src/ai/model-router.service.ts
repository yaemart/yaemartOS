import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AiTaskType = 'listing' | 'faq' | 'recipe' | 'extraction';
export type AiProviderType = 'gemini' | 'glm';

/**
 * Routes AI tasks to the appropriate provider based on taskType + locale.
 *
 * Default routing table (overridable via env var AI_TASK_ROUTER_<TASK>_<LOCALE> = gemini|glm):
 *   faq/*        → glm
 *   recipe/*     → glm
 *   extraction/* → gemini
 *   listing/en   → gemini
 *   listing/*    → gemini (default; GLM for non-EN in S3+)
 */
@Injectable()
export class ModelRouterService {
  private readonly logger = new Logger(ModelRouterService.name);

  constructor(private readonly config: ConfigService) {}

  getProviderType(taskType: AiTaskType, locale: string): AiProviderType {
    const envKey = `AI_TASK_ROUTER_${taskType.toUpperCase()}_${locale.toUpperCase()}`;
    const override = this.config.get<string>(envKey);
    if (override === 'gemini' || override === 'glm') {
      this.logger.debug(`Router override: ${envKey}=${override}`);
      return override;
    }

    const taskKey = `AI_TASK_ROUTER_${taskType.toUpperCase()}`;
    const taskOverride = this.config.get<string>(taskKey);
    if (taskOverride === 'gemini' || taskOverride === 'glm') {
      this.logger.debug(`Router override: ${taskKey}=${taskOverride}`);
      return taskOverride;
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
        return 'gemini';
      default: {
        const _exhaustive: never = taskType;
        this.logger.warn(`Unknown taskType "${_exhaustive as string}" — falling back to gemini`);
        return 'gemini';
      }
    }
  }
}
