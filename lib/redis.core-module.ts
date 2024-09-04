import {
  DynamicModule,
  Module,
  Global,
  Provider,
  OnApplicationShutdown,
} from '@nestjs/common';
import {
  RedisModuleAsyncOptions,
  RedisModuleOptions,
  RedisModuleOptionsFactory,
} from './redis.interfaces';
import {
  createRedisConnection,
  getRedisOptionsToken,
  getRedisConnectionToken,
  tryCloseRedisConnectionPermanently,
} from './redis.utils';
import Redis, { Cluster } from 'ioredis';

@Global()
@Module({})
export class RedisCoreModule implements OnApplicationShutdown {
  private static readonly redisConnections = [] as Array<
    WeakRef<Redis | Cluster>
  >;

  public async onApplicationShutdown() {
    await Promise.all(
      RedisCoreModule.redisConnections.map(async (connection) => {
        const redis = connection.deref();
        if (redis) {
          await tryCloseRedisConnectionPermanently(redis);
        }
      }),
    );
  }

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
      useValue: RedisCoreModule.createAndTrackRedisConnection(options),
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
        return RedisCoreModule.createAndTrackRedisConnection(options);
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
    if (!(options.useExisting || options.useFactory || options.useClass)) {
      throw new Error(
        'Invalid configuration. Must provide useFactory, useClass or useExisting',
      );
    }

    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProvider(options, connection)];
    }

    return [
      this.createAsyncOptionsProvider(options, connection),
      { provide: options.useClass, useClass: options.useClass },
    ];
  }

  /* createAsyncOptionsProvider */
  public static createAsyncOptionsProvider(
    options: RedisModuleAsyncOptions,
    connection?: string,
  ): Provider {
    if (!(options.useExisting || options.useFactory || options.useClass)) {
      throw new Error(
        'Invalid configuration. Must provide useFactory, useClass or useExisting',
      );
    }

    if (options.useFactory) {
      return {
        provide: getRedisOptionsToken(connection),
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    return {
      provide: getRedisOptionsToken(connection),
      async useFactory(
        optionsFactory: RedisModuleOptionsFactory,
      ): Promise<RedisModuleOptions> {
        return await optionsFactory.createRedisModuleOptions();
      },
      inject: [options.useClass || options.useExisting],
    };
  }

  protected static createAndTrackRedisConnection(options: RedisModuleOptions) {
    const redis = createRedisConnection(options);
    this.redisConnections.push(new WeakRef(redis));
    return redis;
  }
}
