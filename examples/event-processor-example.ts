import {
  EventProcessor,
  RedisSessionCache,
  MemoryAuthProvider,
  IEventContext,
  IBroadcastEvent,
  LogLevel,
} from '../src';

async function main() {
  const redisConfig = {
    host: 'localhost',
    port: 6379,
  };

  const authProvider = new MemoryAuthProvider();
  authProvider.addUserToRoom('user1', 'room123');
  authProvider.addUserToRoom('user2', 'room123');
  authProvider.grantPermission('user1', 'room123', 'write');
  authProvider.grantPermission('user2', 'room123', 'read');

  const sessionCache = new RedisSessionCache(redisConfig);
  await sessionCache.setSocketMapping('user1', 'room123', 'socket1');
  await sessionCache.setSocketMapping('user2', 'room123', 'socket2');

  const processor = new EventProcessor({
    redis: redisConfig,
    incomingChannel: 'events:gateway',
    outgoingChannel: 'events:broadcast',
    enableLogging: true,
  });

  processor.setAuthProvider(authProvider);
  processor.setSessionCache(sessionCache);
  processor.setLogLevel(LogLevel.DEBUG);

  processor.registerEventHandler(
    'cursor:move',
    async (context: IEventContext): Promise<IBroadcastEvent | null> => {
      console.log(`Cursor move from ${context.userId}:`, context.event.payload);

      if (!context.roomId) {
        return null;
      }

      const authorizedUsers = await authProvider.getAuthorizedUsersInRoom(
        context.roomId
      );

      const socketIdMap = await sessionCache.getSocketIds(
        authorizedUsers,
        context.roomId
      );

      const recipients: string[] = [];
      socketIdMap.forEach((socketId, userId) => {
        if (socketId && userId !== context.userId) {
          recipients.push(socketId);
        }
      });

      return {
        type: 'cursor:moved',
        recipients,
        payload: {
          userId: context.userId,
          ...context.event.payload,
        },
      };
    }
  );

  processor.registerEventHandler(
    'canvas:save',
    async (context: IEventContext): Promise<IBroadcastEvent[]> => {
      console.log(`Canvas save from ${context.userId}:`, context.event.payload);

      if (!context.roomId) {
        return [
          {
            type: 'error',
            recipients: [context.socketId],
            payload: {
              code: 'NO_ROOM',
              message: 'Room ID is required',
            },
          },
        ];
      }

      const hasPermission = await processor.checkPermission(
        context.userId,
        context.roomId,
        'write'
      );

      if (!hasPermission) {
        return [
          {
            type: 'error',
            recipients: [context.socketId],
            payload: {
              code: 'ACCESS_DENIED',
              message: 'You do not have write permission',
            },
          },
        ];
      }

      console.log('Saving canvas data to database...');

      const authorizedUsers = await authProvider.getAuthorizedUsersInRoom(
        context.roomId
      );
      const socketIdMap = await sessionCache.getSocketIds(
        authorizedUsers,
        context.roomId
      );

      const recipients: string[] = [];
      socketIdMap.forEach((socketId, userId) => {
        if (socketId) {
          recipients.push(socketId);
        }
      });

      return [
        {
          type: 'canvas:saved',
          recipients: [context.socketId],
          payload: {
            success: true,
            savedAt: Date.now(),
          },
        },
        {
          type: 'canvas:updated',
          recipients: recipients.filter((id) => id !== context.socketId),
          payload: {
            userId: context.userId,
            data: context.event.payload,
          },
        },
      ];
    }
  );

  processor.registerEventHandler(
    'chat:message',
    async (context: IEventContext): Promise<IBroadcastEvent | null> => {
      console.log(`Chat message from ${context.userId}:`, context.event.payload);

      if (!context.roomId) {
        return null;
      }

      await processor.broadcastToRoom(
        context.roomId,
        'chat:newMessage',
        {
          userId: context.userId,
          message: context.event.payload,
          timestamp: Date.now(),
        },
        [context.socketId]
      );

      return null;
    }
  );

  processor.registerEventHandler(
    'user:typing',
    async (context: IEventContext): Promise<IBroadcastEvent | null> => {
      if (!context.roomId) {
        return null;
      }

      await processor.broadcastToRoom(
        context.roomId,
        'user:isTyping',
        {
          userId: context.userId,
          isTyping: context.event.payload,
        },
        [context.socketId]
      );

      return null;
    }
  );

  await processor.start();
  console.log('Event Processor is running...');
  console.log('Registered event types:', processor.getRegisteredEventTypes());

  process.on('SIGINT', async () => {
    console.log('\nShutting down Event Processor...');
    await processor.stop();
    await sessionCache.disconnect();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Failed to start Event Processor:', error);
  process.exit(1);
});
