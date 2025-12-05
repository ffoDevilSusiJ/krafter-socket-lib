import { IResponse, MessageType } from '../types/index.js';
import { Message } from './Message.js';

export class Response extends Message implements IResponse {
  public readonly type: MessageType.RESPONSE = MessageType.RESPONSE;
  public readonly requestId: string;
  public readonly success: boolean;

  constructor(requestId: string, success: boolean, payload: unknown, id?: string) {
    super(MessageType.RESPONSE, payload, id);
    this.requestId = requestId;
    this.success = success;
  }

  public toJSON(): IResponse {
    return {
      ...super.toJSON(),
      type: MessageType.RESPONSE,
      requestId: this.requestId,
      success: this.success,
    };
  }

  public static fromJSON(data: IResponse): Response {
    return new Response(data.requestId, data.success, data.payload, data.id);
  }

  public static success(requestId: string, payload: unknown): Response {
    return new Response(requestId, true, payload);
  }

  public static error(requestId: string, error: unknown): Response {
    return new Response(requestId, false, error);
  }
}
