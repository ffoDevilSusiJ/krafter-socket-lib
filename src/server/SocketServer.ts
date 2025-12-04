import { Server, Socket } from 'socket.io';
import { createServer, Server as HttpServer } from 'http';
import { ISocketServerConfig, MessageType } from '../types';
import { Request, Event } from '../dto';
import { Logger, LogLevel, MessageValidator, ErrorHandler } from '../utils';
import { ClientConnection } from './ClientConnection';
import { RequestHandler, RequestHandlerFunction } from './RequestHandler';

export class SocketServer {
  private io: Server;
  private httpServer: HttpServer;
  private config: ISocketServerConfig;
  private logger: Logger;
  private errorHandler: ErrorHandler;
  private requestHandler: RequestHandler;
  private clients: Map<string, ClientConnection>;
  private eventHandlers: Map<string, Set<(event: Event, client: ClientConnection) => void>>;

  constructor(config: ISocketServerConfig = {}) {
    this.config = {
      port: config.port || 3000,
      path: config.path || '/socket.io',
      cors: config.cors || { origin: '*' },
      pingTimeout: config.pingTimeout || 60000,
      pingInterval: config.pingInterval || 25000,
      ...config,
    };

    this.logger = new Logger({ prefix: '[SocketServer]', level: LogLevel.INFO });
    this.errorHandler = new ErrorHandler({ logger: this.logger });
    this.requestHandler = new RequestHandler();
    this.clients = new Map();
    this.eventHandlers = new Map();

    this.httpServer = createServer();
    this.io = new Server(this.httpServer, {
      path: this.config.path,
      cors: this.config.cors,
      pingTimeout: this.config.pingTimeout,
      pingInterval: this.config.pingInterval,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });
  }

  private handleConnection(socket: Socket): void {
    const client = new ClientConnection(socket, this.logger);
    this.clients.set(socket.id, client);

    socket.on('message', async (data: unknown) => {
      await this.handleMessage(data, client);
    });

    client.onDisconnect((reason) => {
      this.handleDisconnection(client, reason);
    });

    client.onError((error) => {
      this.logger.error(`Client error: ${socket.id}`, error);
    });

    this.emitToClient(client, new Event('connected', { clientId: socket.id }));
  }

  private async handleMessage(data: unknown, client: ClientConnection): Promise<void> {
    if (!MessageValidator.isValidMessage(data)) {
      const error = ErrorHandler.createValidationError('Invalid message format');
      client.sendError(error);
      return;
    }

    const message = data as any;

    try {
      if (message.type === MessageType.REQUEST) {
        await this.handleRequest(Request.fromJSON(message), client);
      } else if (message.type === MessageType.EVENT) {
        await this.handleEvent(Event.fromJSON(message), client);
      }
    } catch (error) {
      const errorMessage = this.errorHandler.handleError(error, 'handleMessage');
      client.sendError(errorMessage);
    }
  }

  private async handleRequest(request: Request, client: ClientConnection): Promise<void> {
    this.logger.debug(`Handling request: ${request.action}`, { requestId: request.id });

    try {
      const response = await this.requestHandler.handle(request, client);
      client.sendResponse(response);
    } catch (error) {
      const errorMessage = this.errorHandler.handleError(error, `request:${request.action}`);
      client.sendError(errorMessage);
    }
  }

  private async handleEvent(event: Event, client: ClientConnection): Promise<void> {
    this.logger.debug(`Handling event: ${event.eventName}`, { eventId: event.id });

    const handlers = this.eventHandlers.get(event.eventName);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event, client);
        } catch (error) {
          this.logger.error(`Error in event handler for ${event.eventName}`, error);
        }
      }
    }
  }

  private handleDisconnection(client: ClientConnection, reason: string): void {
    this.logger.info(`Client disconnected: ${client.getId()}, reason: ${reason}`);
    this.clients.delete(client.getId());
  }

  public registerRequestHandler(action: string, handler: RequestHandlerFunction): void {
    this.requestHandler.register(action, handler);
    this.logger.info(`Registered request handler for action: ${action}`);
  }

  public registerEventHandler(
    eventName: string,
    handler: (event: Event, client: ClientConnection) => void
  ): void {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, new Set());
    }
    this.eventHandlers.get(eventName)!.add(handler);
    this.logger.info(`Зарегестрированно событие: ${eventName}`);
  }

  public emitToClient(client: ClientConnection, event: Event): void {
    client.sendEvent(event);
  }

  public emitToAll(event: Event): void {
    this.logger.debug(`Трансляция события события всем подключенным клиентам: ${event.eventName}`);
    this.clients.forEach((client) => {
      client.sendEvent(event);
    });
  }

  public emitToRoom(room: string, event: Event): void {
    this.logger.debug(`Трансляция события всем клиентам в комнате ${room}: ${event.eventName}`);
    this.io.to(room).emit('message', event.toJSON());
  }

  public getClient(clientId: string): ClientConnection | undefined {
    return this.clients.get(clientId);
  }

  public getClients(): ClientConnection[] {
    return Array.from(this.clients.values());
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }

  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.listen(this.config.port, () => {
        this.logger.info(`Socket.IO запущен на порту ${this.config.port}`);
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    this.clients.forEach((client) => {
      client.disconnect('Server shutting down');
    });

    return new Promise((resolve) => {
      this.io.close(() => {
        this.httpServer.close(() => {
          resolve();
        });
      });
    });
  }

  public setLogLevel(level: LogLevel): void {
    this.logger.setLevel(level);
  }

  public getServer(): Server {
    return this.io;
  }

  public getHttpServer(): HttpServer {
    return this.httpServer;
  }
}
