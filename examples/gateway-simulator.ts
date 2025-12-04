import Redis from 'ioredis';
import { IGatewayEvent } from '../src';

const redis = new Redis({
  host: 'localhost',
  port: 6379,
});

async function simulateGatewayEvent(event: IGatewayEvent): Promise<void> {
  console.log('Simulating gateway event:', event);
  await redis.publish('events:gateway', JSON.stringify(event));
}

async function listenForBroadcasts(): Promise<void> {
  const subscriber = new Redis({
    host: 'localhost',
    port: 6379,
  });

  await subscriber.subscribe('events:broadcast');

  subscriber.on('message', (channel, message) => {
    console.log('\nReceived broadcast event:');
    console.log(JSON.parse(message));
  });

  console.log('Listening for broadcast events...\n');
}

async function main() {
  await listenForBroadcasts();

  console.log('Gateway Simulator started. Press Ctrl+C to exit.\n');

  console.log('1. Simulating cursor move event...');
  await simulateGatewayEvent({
    eventType: 'cursor:move',
    userId: 'user1',
    socketId: 'socket1',
    roomId: 'room123',
    payload: { x: 100, y: 200 },
    timestamp: Date.now(),
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log('\n2. Simulating canvas save event (with permission)...');
  await simulateGatewayEvent({
    eventType: 'canvas:save',
    userId: 'user1',
    socketId: 'socket1',
    roomId: 'room123',
    payload: { canvasData: 'base64encodeddata...' },
    timestamp: Date.now(),
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log('\n3. Simulating canvas save event (without permission)...');
  await simulateGatewayEvent({
    eventType: 'canvas:save',
    userId: 'user2',
    socketId: 'socket2',
    roomId: 'room123',
    payload: { canvasData: 'base64encodeddata...' },
    timestamp: Date.now(),
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log('\n4. Simulating chat message...');
  await simulateGatewayEvent({
    eventType: 'chat:message',
    userId: 'user1',
    socketId: 'socket1',
    roomId: 'room123',
    payload: 'Hello everyone!',
    timestamp: Date.now(),
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log('\n5. Simulating typing indicator...');
  await simulateGatewayEvent({
    eventType: 'user:typing',
    userId: 'user2',
    socketId: 'socket2',
    roomId: 'room123',
    payload: true,
    timestamp: Date.now(),
  });

  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log('\nSimulation complete. Press Ctrl+C to exit.');
}

main().catch((error) => {
  console.error('Error in gateway simulator:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\nExiting...');
  redis.quit();
  process.exit(0);
});
