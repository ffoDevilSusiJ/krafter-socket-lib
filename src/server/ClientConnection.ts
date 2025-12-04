import { Socket } from 'socket.io';
import { IClientInfo, ConnectionStatus } from '../types';
import { Request, Response, Event, ErrorMessage } from '../dto';
import { Logger } from '../utils';

export class ClientConnection {
  private socket: Socket;
  private info: IClientInfo;
  private logger: Logger;

  constructor(socket: Socket, logger?: Logger) {
    this.socket = socket;
    this.logger = logger || new Logger({ prefix: `[Client:${socket.id}]` });
    this.info = {
      id: socket.id,
      connectedAt: Date.now(),
      status: ConnectionStatus.CONNECTED,
      metadata: {},
    };
  }

  public getId(): string {
    return this.socket.id;
  }

  public getInfo(): IClientInfo {
    return { ...this.info };
  }

  public setMetadata(key: string, value: unknown): void {
    if (!this.info.metadata) {
      this.info.metadata = {};
    }
    this.info.metadata[key] = value;
  }

  public getMetadata(key: string): unknown {
    return this.info.metadata?.[key];
  }

  public sendResponse(response: Response): void {
    this.logger.debug('Sending response', response.toJSON());
    this.socket.emit('message', response.toJSON());
  }

  public sendEvent(event: Event): void {
    this.logger.debug('Sending event', event.toJSON());
    this.socket.emit('message', event.toJSON());
  }

  public sendError(error: ErrorMessage): void {
    this.logger.debug('Sending error', error.toJSON());
    this.socket.emit('message', error.toJSON());
  }

  public disconnect(reason?: string): void {
    this.logger.info(`Disconnecting client${reason ? `: ${reason}` : ''}`);
    this.info.status = ConnectionStatus.DISCONNECTED;
    this.socket.disconnect(true);
  }

  public isConnected(): boolean {
    return this.socket.connected && this.info.status === ConnectionStatus.CONNECTED;
  }

  public onDisconnect(callback: (reason: string) => void): void {
    this.socket.on('disconnect', (reason) => {
      this.info.status = ConnectionStatus.DISCONNECTED;
      this.logger.info(`Client disconnected: ${reason}`);
      callback(reason);
    });
  }

  public onError(callback: (error: Error) => void): void {
    this.socket.on('error', (error) => {
      this.logger.error('Socket error', error);
      callback(error);
    });
  }

  public getSocket(): Socket {
    return this.socket;
  }
}
