import {
  IEventProcessorConfig,
  IGatewayEvent,
  IBroadcastEvent,
  IEventContext,
  EventHandler,
  IAuthProvider,
  ISessionCacheProvider,
} from '../types';
import { RedisPubSub } from '../redis';
import { Logger, LogLevel, ErrorHandler, EventParser } from '../utils';

export class EventProcessor {
  private redisPubSub: RedisPubSub;
  private config: IEventProcessorConfig;
  private logger: Logger;
  private errorHandler: ErrorHandler;
  private eventHandlers: Map<string, EventHandler>;
  private authProvider?: IAuthProvider;
  private sessionCache?: ISessionCacheProvider;
  private isRunning: boolean = false;

  constructor(config: IEventProcessorConfig) {
    this.config = config;
    this.logger = new Logger({
      prefix: '[EventProcessor]',
      level: config.enableLogging ? LogLevel.DEBUG : LogLevel.INFO,
    });
    this.errorHandler = new ErrorHandler({ logger: this.logger });
    this.eventHandlers = new Map();
    this.redisPubSub = new RedisPubSub(config.redis, this.logger);
  }

  public setAuthProvider(provider: IAuthProvider): void {
    this.authProvider = provider;
    this.logger.info('Auth provider set');
  }

  public setSessionCache(cache: ISessionCacheProvider): void {
    this.sessionCache = cache;
    this.logger.info('Session cache set');
  }

  public registerEventHandler(eventType: string, handler: EventHandler): void {
    if (this.eventHandlers.has(eventType)) {
      throw new Error(`Handler for event type '${eventType}' is already registered`);
    }
    this.eventHandlers.set(eventType, handler);
    this.logger.info(`Registered event handler for: ${eventType}`);
  }

  public unregisterEventHandler(eventType: string): boolean {
    const result = this.eventHandlers.delete(eventType);
    if (result) {
      this.logger.info(`Unregistered event handler for: ${eventType}`);
    }
    return result;
  }

  private async handleIncomingMessage(message: string): Promise<void> {
    try {
      const event: IGatewayEvent = JSON.parse(message);

      const parsedEvent = EventParser.parseEventType(event.eventType);
      if (!parsedEvent) {
        const errorMsg = `Invalid event format: ${event.eventType}. Expected format: serviceName:module:name`;
        this.logger.error(errorMsg);

        // Отправляем ошибку обратно отправителю
        const errorBroadcast: IBroadcastEvent = {
          type: 'error',
          recipients: [event.socketId],
          payload: {
            code: 'INVALID_EVENT_FORMAT',
            message: errorMsg,
            eventType: event.eventType,
          },
        };
        await this.broadcast(errorBroadcast);
        return;
      }

      event.serviceName = parsedEvent.serviceName;
      event.module = parsedEvent.module;
      event.eventName = parsedEvent.eventName;

      this.logger.debug(
        `Получено событие: ${event.eventType} (service: ${event.serviceName}, module: ${event.module}, name: ${event.eventName})`,
        event
      );

      await this.processEvent(event);
    } catch (error) {
      this.logger.error('Failed to handle incoming message', error);
      this.errorHandler.handleError(error, 'handleIncomingMessage');
    }
  }

  private async processEvent(event: IGatewayEvent): Promise<void> {
    const handler = this.eventHandlers.get(event.eventType);

    if (!handler) {
      this.logger.warn(`Нет обработчика для события: ${event.eventType}. Отправка ошибки клиенту`);

      // Отправляем ошибку клиенту
      const errorBroadcast: IBroadcastEvent = {
        type: 'error',
        recipients: [event.socketId],
        payload: {
          code: 'NO_HANDLER',
          message: `No handler registered for event type: ${event.eventType}`,
          eventType: event.eventType,
        },
      };
      await this.broadcast(errorBroadcast);
      return;
    }

    try {
      const context: IEventContext = {
        event,
        userId: event.userId,
        socketId: event.socketId,
        roomId: event.roomId,
      };

      const broadcastEvent = await handler(context);

      if (broadcastEvent) {
        if (Array.isArray(broadcastEvent)) {
          for (const evt of broadcastEvent) {
            await this.broadcast(evt);
          }
        } else {
          await this.broadcast(broadcastEvent);
        }
      }
    } catch (error) {
      this.logger.error(`Error processing event ${event.eventType}`, error);

      const errorBroadcast: IBroadcastEvent = {
        type: 'error',
        recipients: [event.socketId],
        payload: {
          code: 'EVENT_PROCESSING_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };

      await this.broadcast(errorBroadcast);
    }
  }

  public async broadcast(event: IBroadcastEvent): Promise<void> {
    try {
      await this.redisPubSub.publishJSON(this.config.outgoingChannel, event);
      this.logger.debug(`Broadcast event: ${event.type}`, {
        recipients: event.recipients.length,
      });
    } catch (error) {
      this.logger.error('Failed to broadcast event', error);
      throw error;
    }
  }

  public async broadcastToRoom(
    roomId: string,
    type: string,
    payload: unknown,
    excludeSocketIds?: string[]
  ): Promise<void> {
    if (!this.authProvider || !this.sessionCache) {
      throw new Error('Auth provider and session cache must be set');
    }

    try {
      const authorizedUsers = await this.authProvider.getAuthorizedUsersInRoom(roomId);
      const socketIdMap = await this.sessionCache.getSocketIds(authorizedUsers, roomId);

      const recipients: string[] = [];
      socketIdMap.forEach((socketId, userId) => {
        if (socketId && (!excludeSocketIds || !excludeSocketIds.includes(socketId))) {
          recipients.push(socketId);
        }
      });

      const broadcastEvent: IBroadcastEvent = {
        type,
        recipients,
        payload,
        excludeSocketIds,
      };

      await this.broadcast(broadcastEvent);
    } catch (error) {
      this.logger.error(`Failed to broadcast to room ${roomId}`, error);
      throw error;
    }
  }

  public async broadcastToUser(
    userId: string,
    roomId: string,
    type: string,
    payload: unknown
  ): Promise<void> {
    if (!this.sessionCache) {
      throw new Error('Session cache must be set');
    }

    try {
      const socketId = await this.sessionCache.getSocketId(userId, roomId);

      if (socketId) {
        const broadcastEvent: IBroadcastEvent = {
          type,
          recipients: [socketId],
          payload,
        };

        await this.broadcast(broadcastEvent);
      } else {
        this.logger.warn(`No socket found for user ${userId} in room ${roomId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to broadcast to user ${userId}`, error);
      throw error;
    }
  }

  public async checkPermission(
    userId: string,
    roomId: string,
    action: string
  ): Promise<boolean> {
    if (!this.authProvider) {
      this.logger.warn('Auth provider not set, allowing all permissions');
      return true;
    }

    try {
      return await this.authProvider.checkPermission(userId, roomId, action);
    } catch (error) {
      this.logger.error(`Failed to check permission for ${userId}`, error);
      return false;
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Event processor is already running');
      return;
    }

    this.logger.info('Starting Event Processor...');

    await this.redisPubSub.subscribe(
      this.config.incomingChannel,
      this.handleIncomingMessage.bind(this)
    );

    this.isRunning = true;
    this.logger.info(
      `Event Processor started. Listening on: ${this.config.incomingChannel}`
    );
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Event processor is not running');
      return;
    }

    this.logger.info('Stopping Event Processor...');

    await this.redisPubSub.unsubscribe(this.config.incomingChannel);
    await this.redisPubSub.disconnect();

    this.isRunning = false;
    this.logger.info('Event Processor stopped');
  }

  public isActive(): boolean {
    return this.isRunning;
  }

  public getRegisteredEventTypes(): string[] {
    return Array.from(this.eventHandlers.keys());
  }

  public setLogLevel(level: LogLevel): void {
    this.logger.setLevel(level);
  }
}
