import {
  SocketServer,
  Request,
  Response,
  Event,
  LogLevel,
  ClientConnection,
} from '../src';

async function main() {
  const server = new SocketServer({
    port: 3000,
    cors: {
      origin: '*',
    },
  });

  server.setLogLevel(LogLevel.DEBUG);

  server.registerRequestHandler('echo', async (request: Request) => {
    console.log('Echo request received:', request.payload);
    return Response.success(request.id, request.payload);
  });

  server.registerRequestHandler('getTime', async (request: Request) => {
    return Response.success(request.id, {
      time: new Date().toISOString(),
    });
  });

  server.registerRequestHandler('calculate', async (request: Request) => {
    const { operation, a, b } = request.payload as any;

    let result: number;
    switch (operation) {
      case 'add':
        result = a + b;
        break;
      case 'subtract':
        result = a - b;
        break;
      case 'multiply':
        result = a * b;
        break;
      case 'divide':
        if (b === 0) {
          return Response.error(request.id, {
            code: 'DIVISION_BY_ZERO',
            message: 'Cannot divide by zero',
          });
        }
        result = a / b;
        break;
      default:
        return Response.error(request.id, {
          code: 'UNKNOWN_OPERATION',
          message: `Unknown operation: ${operation}`,
        });
    }

    return Response.success(request.id, { result });
  });

  server.registerEventHandler('chat', (event: Event, client: ClientConnection) => {
    console.log(`Chat message from ${client.getId()}:`, event.payload);

    const username = client.getMetadata('username') || 'Anonymous';

    server.emitToAll(
      new Event('chat', {
        from: username,
        message: event.payload,
        timestamp: Date.now(),
      })
    );
  });

  server.registerEventHandler('setUsername', (event: Event, client: ClientConnection) => {
    const username = event.payload as string;
    client.setMetadata('username', username);

    server.emitToClient(
      client,
      new Event('usernameSet', {
        success: true,
        username,
      })
    );
  });

  await server.start();
  console.log('Server is running on port 3000');

  setInterval(() => {
    const clientCount = server.getConnectedClientsCount();
    console.log(`Connected clients: ${clientCount}`);

    if (clientCount > 0) {
      server.emitToAll(
        new Event('serverStats', {
          connectedClients: clientCount,
          uptime: process.uptime(),
          timestamp: Date.now(),
        })
      );
    }
  }, 30000);

  process.on('SIGINT', async () => {
    console.log('\nShutting down server...');
    await server.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
