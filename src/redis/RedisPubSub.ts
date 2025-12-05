import Redis from 'ioredis';
import { IRedisConfig } from '../types/index.js';
import { Logger } from '../utils/index.js';

export class RedisPubSub {
  private publisher: Redis;
  private subscriber: Redis;
  private logger: Logger;
  private subscriptions: Map<string, Set<(message: string) => void>>;

  constructor(config: IRedisConfig, logger?: Logger) {
    this.logger = logger || new Logger({ prefix: '[RedisPubSub]' });
    this.subscriptions = new Map();

    const redisOptions = {
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db || 0,
      retryStrategy: config.retryStrategy || this.defaultRetryStrategy,
    };

    this.publisher = new Redis(redisOptions);
    this.subscriber = new Redis(redisOptions);

    this.setupEventHandlers();
  }

  private defaultRetryStrategy(times: number): number | null {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }

  private setupEventHandlers(): void {
    this.publisher.on('connect', () => {
      this.logger.info('Publisher connected to Redis');
    });

    this.publisher.on('error', (error) => {
      this.logger.error('Publisher Redis error', error);
    });

    this.subscriber.on('connect', () => {
      this.logger.info('Subscriber connected to Redis');
    });

    this.subscriber.on('error', (error) => {
      this.logger.error('Subscriber Redis error', error);
    });

    this.subscriber.on('message', (channel, message) => {
      this.handleMessage(channel, message);
    });
  }

  private handleMessage(channel: string, message: string): void {
    const handlers = this.subscriptions.get(channel);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(message);
        } catch (error) {
          this.logger.error(`Error handling message on channel ${channel}`, error);
        }
      });
    }
  }

  public async subscribe(
    channel: string,
    handler: (message: string) => void
  ): Promise<void> {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      await this.subscriber.subscribe(channel);
      this.logger.info(`Subscribed to channel: ${channel}`);
    }

    this.subscriptions.get(channel)!.add(handler);
  }

  public async unsubscribe(
    channel: string,
    handler?: (message: string) => void
  ): Promise<void> {
    const handlers = this.subscriptions.get(channel);
    if (!handlers) return;

    if (handler) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        await this.subscriber.unsubscribe(channel);
        this.subscriptions.delete(channel);
        this.logger.info(`Unsubscribed from channel: ${channel}`);
      }
    } else {
      await this.subscriber.unsubscribe(channel);
      this.subscriptions.delete(channel);
      this.logger.info(`Unsubscribed from channel: ${channel}`);
    }
  }

  public async publish(channel: string, message: string): Promise<void> {
    try {
      await this.publisher.publish(channel, message);
      this.logger.debug(`Published message to channel: ${channel}`);
    } catch (error) {
      this.logger.error(`Failed to publish to channel: ${channel}`, error);
      throw error;
    }
  }

  public async publishJSON(channel: string, data: unknown): Promise<void> {
    const message = JSON.stringify(data);
    await this.publish(channel, message);
  }

  public async disconnect(): Promise<void> {
    this.logger.info('Disconnecting from Redis...');
    await Promise.all([this.publisher.quit(), this.subscriber.quit()]);
    this.logger.info('Disconnected from Redis');
  }

  public getPublisher(): Redis {
    return this.publisher;
  }

  public getSubscriber(): Redis {
    return this.subscriber;
  }
}
