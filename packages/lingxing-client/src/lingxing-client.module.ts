import { DynamicModule, Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { LingxingClient } from './lingxing-client';
import { LingxingClientOptions } from './lingxing-client.options';
import { AuthManager } from './client/auth-manager';
import { HttpTransport } from './client/http-transport';
import { LingxingMcpBridge } from './mcp/mcp-bridge';

export const LINGXING_CLIENT_OPTIONS = Symbol('LINGXING_CLIENT_OPTIONS');
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({})
export class LingxingClientModule {
  static forRoot(options: LingxingClientOptions): DynamicModule {
    return {
      module: LingxingClientModule,
      providers: [
        {
          provide: LINGXING_CLIENT_OPTIONS,
          useValue: options,
        },
        {
          provide: REDIS_CLIENT,
          useFactory: () => new Redis(options.redisUrl),
        },
        AuthManager,
        HttpTransport,
        LingxingClient,
        LingxingMcpBridge,
      ],
      exports: [LingxingClient, LingxingMcpBridge, LINGXING_CLIENT_OPTIONS, REDIS_CLIENT],
    };
  }
}
