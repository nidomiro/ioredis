import { DynamicModule, Module, Global, Provider } from '@nestjs/common';
import {
  RedisModuleAsyncOptions,
  RedisModuleOptions,
  RedisModuleOptionsFactory,
} from './redis.interfaces';
import {
  createRedisConnection,
  getRedisOptionsToken,
  getRedisConnectionToken,
} from './redis.utils';

@Global()
@Module({})
export class RedisCoreModule {
  /* forRoot */
  static forRoot(
    options: RedisModuleOptions,
    connection?: string,
  ): DynamicModule {
    const redisOptionsProvider: Provider = {
      provide: getRedisOptionsToken(connection),
      useValue: options,
    };

    const redisConnectionProvider: Provider = {
      provide: getRedisConnectionToken(connection),
      useValue: createRedisConnection(options),
    };

    return {
      module: RedisCoreModule,
      providers: [redisOptionsProvider, redisConnectionProvider],
      exports: [redisOptionsProvider, redisConnectionProvider],
    };
  }

  /* forRootAsync */
  public static forRootAsync(
    options: RedisModuleAsyncOptions,
    connection?: string,
  ): DynamicModule {
    const redisConnectionProvider: Provider = {
      provide: getRedisConnectionToken(connection),
      useFactory(options: RedisModuleOptions) {
        return createRedisConnection(options);
      },
      inject: [getRedisOptionsToken(connection)],
    };

    return {
      module: RedisCoreModule,
      imports: options.imports,
      providers: [
        ...this.createAsyncProviders(options, connection),
        redisConnectionProvider,
      ],
      exports: [redisConnectionProvider],
    };
  }

  /* createAsyncProviders */
  public static createAsyncProviders(
    options: RedisModuleAsyncOptions,
    connection?: string,
  ): Provider[] {
    if (
      options.useExisting == null &&
      options.useExisting == null &&
      options.useExisting == null
    ) {
      throw new Error(
        'Invalid configuration. Must provide useFactory, useClass or useExisting',
      );
    }

    if (options.useExisting == null) {
      return [this.createAsyncOptionsProvider(options, connection)];
    }

    return [
      this.createAsyncOptionsProvider(options, connection),
      { provide: options.useExisting, useClass: options.useExisting },
    ];
  }

  /* createAsyncOptionsProvider */
  public static createAsyncOptionsProvider(
    options: RedisModuleAsyncOptions,
    connection?: string,
  ): Provider {
    if (
      options.useExisting == null &&
      options.useExisting == null &&
      options.useExisting == null
    ) {
      throw new Error(
        'Invalid configuration. Must provide useFactory, useClass or useExisting',
      );
    }

    if (options.useFactory != null) {
      return {
        provide: getRedisOptionsToken(connection),
        useFactory: options.useFactory,
        inject: options.inject ?? [],
      };
    }

    return {
      provide: getRedisOptionsToken(connection),
      async useFactory(
        optionsFactory: RedisModuleOptionsFactory,
      ): Promise<RedisModuleOptions> {
        return await optionsFactory.createRedisModuleOptions();
      },
      inject: [options.useClass ?? options.useExisting],
    };
  }
}
