import { IMessage, MessageType } from '../types';

export class MessageValidator {
  public static isValidMessage(data: unknown): data is IMessage {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const msg = data as Partial<IMessage>;

    return (
      typeof msg.id === 'string' &&
      typeof msg.type === 'string' &&
      Object.values(MessageType).includes(msg.type as MessageType) &&
      typeof msg.timestamp === 'number' &&
      'payload' in msg
    );
  }

  public static validateRequest(data: unknown): boolean {
    if (!this.isValidMessage(data)) {
      return false;
    }

    const msg = data as any;
    return msg.type === MessageType.REQUEST && typeof msg.action === 'string';
  }

  public static validateResponse(data: unknown): boolean {
    if (!this.isValidMessage(data)) {
      return false;
    }

    const msg = data as any;
    return (
      msg.type === MessageType.RESPONSE &&
      typeof msg.requestId === 'string' &&
      typeof msg.success === 'boolean'
    );
  }

  public static validateEvent(data: unknown): boolean {
    if (!this.isValidMessage(data)) {
      return false;
    }

    const msg = data as any;
    return msg.type === MessageType.EVENT && typeof msg.eventName === 'string';
  }

  public static validateError(data: unknown): boolean {
    if (!this.isValidMessage(data)) {
      return false;
    }

    const msg = data as any;
    return (
      msg.type === MessageType.ERROR &&
      typeof msg.code === 'string' &&
      typeof msg.message === 'string'
    );
  }
}
