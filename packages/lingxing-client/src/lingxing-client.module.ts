import { DynamicModule, Global, Module } from '@nestjs/common';
import { LingxingClient } from './lingxing-client';
import { LingxingClientOptions } from './lingxing-client.options';

export const LINGXING_CLIENT_OPTIONS = Symbol('LINGXING_CLIENT_OPTIONS');

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
        LingxingClient,
      ],
      exports: [LingxingClient, LINGXING_CLIENT_OPTIONS],
    };
  }
}
