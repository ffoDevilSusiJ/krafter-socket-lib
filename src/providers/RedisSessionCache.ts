import Redis from 'ioredis';
import { ISessionCacheProvider, IRedisConfig } from '../types/index.js';
import { Logger } from '../utils/index.js';

export class RedisSessionCache implements ISessionCacheProvider {
  private redis: Redis;
  private logger: Logger;
  private keyPrefix: string;

  constructor(config: IRedisConfig, keyPrefix: string = 'socket:', logger?: Logger) {
    this.logger = logger || new Logger({ prefix: '[SessionCache]' });
    this.keyPrefix = keyPrefix;

    this.redis = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db || 0,
      retryStrategy: config.retryStrategy,
    });

    this.redis.on('connect', () => {
      this.logger.info('Connected to Redis Session Cache');
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis Session Cache error', error);
    });
  }

  private getKey(userId: string, roomId: string): string {
    return `${this.keyPrefix}${userId}:${roomId}`;
  }

  public async getSocketId(userId: string, roomId: string): Promise<string | null> {
    try {
      const key = this.getKey(userId, roomId);
      const socketId = await this.redis.get(key);
      return socketId;
    } catch (error) {
      this.logger.error(`Failed to get socket ID for ${userId} in ${roomId}`, error);
      return null;
    }
  }

  public async getSocketIds(
    userIds: string[],
    roomId: string
  ): Promise<Map<string, string | null>> {
    const result = new Map<string, string | null>();

    try {
      const keys = userIds.map((userId) => this.getKey(userId, roomId));
      const socketIds = await this.redis.mget(...keys);

      userIds.forEach((userId, index) => {
        result.set(userId, socketIds[index]);
      });
    } catch (error) {
      this.logger.error(`Failed to get socket IDs for users in ${roomId}`, error);
      userIds.forEach((userId) => result.set(userId, null));
    }

    return result;
  }

  public async setSocketMapping(
    userId: string,
    roomId: string,
    socketId: string
  ): Promise<void> {
    try {
      const key = this.getKey(userId, roomId);
      await this.redis.set(key, socketId);
      this.logger.debug(`Set socket mapping: ${userId}:${roomId} -> ${socketId}`);
    } catch (error) {
      this.logger.error(
        `Failed to set socket mapping for ${userId} in ${roomId}`,
        error
      );
      throw error;
    }
  }

  public async removeSocketMapping(userId: string, roomId: string): Promise<void> {
    try {
      const key = this.getKey(userId, roomId);
      await this.redis.del(key);
      this.logger.debug(`Removed socket mapping: ${userId}:${roomId}`);
    } catch (error) {
      this.logger.error(
        `Failed to remove socket mapping for ${userId} in ${roomId}`,
        error
      );
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    await this.redis.quit();
    this.logger.info('Disconnected from Redis Session Cache');
  }
}
