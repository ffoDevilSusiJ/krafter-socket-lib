import { IMessage, MessageType } from '../types/index.js';

export abstract class Message implements IMessage {
  public readonly id: string;
  public readonly type: MessageType;
  public readonly timestamp: number;
  public readonly payload: unknown;

  constructor(type: MessageType, payload: unknown, id?: string) {
    this.id = id || this.generateId();
    this.type = type;
    this.timestamp = Date.now();
    this.payload = payload;
  }

  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public toJSON(): IMessage {
    return {
      id: this.id,
      type: this.type,
      timestamp: this.timestamp,
      payload: this.payload,
    };
  }

  public static fromJSON(data: IMessage): Message {
    throw new Error('fromJSON must be implemented in derived class');
  }
}
