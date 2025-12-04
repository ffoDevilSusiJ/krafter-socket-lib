export enum MessageType {
  REQUEST = 'request',
  RESPONSE = 'response',
  EVENT = 'event',
  ERROR = 'error',
}

export enum ConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
}

export interface IMessage {
  id: string;
  type: MessageType;
  timestamp: number;
  payload: unknown;
}

export interface IRequest extends IMessage {
  type: MessageType.REQUEST;
  action: string;
}

export interface IResponse extends IMessage {
  type: MessageType.RESPONSE;
  requestId: string;
  success: boolean;
}

export interface IEvent extends IMessage {
  type: MessageType.EVENT;
  eventName: string;
}

export interface IError extends IMessage {
  type: MessageType.ERROR;
  code: string;
  message: string;
}

export interface IRedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  retryStrategy?: (times: number) => number | null;
}

export interface IEventProcessorConfig {
  redis: IRedisConfig;
  incomingChannel: string;
  outgoingChannel: string;
  enableLogging?: boolean;
}

export interface IGatewayEvent {
  eventType: string;
  serviceName?: string;
  module?: string;
  eventName?: string;
  userId: string;
  socketId: string;
  roomId?: string;
  payload: unknown;
  timestamp: number;
}

export interface IBroadcastEvent {
  type: string;
  recipients: string[];
  payload: unknown;
  excludeSocketIds?: string[];
}

export interface IAuthProvider {
  checkPermission(userId: string, roomId: string, action: string): Promise<boolean>;
  getAuthorizedUsersInRoom(roomId: string): Promise<string[]>;
}

export interface ISessionCacheProvider {
  getSocketId(userId: string, roomId: string): Promise<string | null>;
  getSocketIds(userIds: string[], roomId: string): Promise<Map<string, string | null>>;
  setSocketMapping(userId: string, roomId: string, socketId: string): Promise<void>;
  removeSocketMapping(userId: string, roomId: string): Promise<void>;
}

export interface IEventContext {
  event: IGatewayEvent;
  userId: string;
  socketId: string;
  roomId?: string;
}

export type EventHandler = (context: IEventContext) => Promise<IBroadcastEvent | IBroadcastEvent[] | null>;

export interface IServiceConfig {
  serviceName: string;
  channel: string;
}

export interface IEventRoute {
  serviceName: string;
  module: string;
  eventName: string;
}

export interface ISocketServerConfig {
  port?: number;
  path?: string;
  cors?: {
    origin: string | string[];
    credentials?: boolean;
  };
  pingTimeout?: number;
  pingInterval?: number;
}

export interface IClientInfo {
  id: string;
  connectedAt: number;
  status: ConnectionStatus;
  metadata?: Record<string, unknown>;
}
