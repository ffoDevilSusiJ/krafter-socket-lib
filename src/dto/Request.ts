import { IRequest, MessageType } from '../types';
import { Message } from './Message';

export class Request extends Message implements IRequest {
  public readonly type: MessageType.REQUEST = MessageType.REQUEST;
  public readonly action: string;

  constructor(action: string, payload: unknown, id?: string) {
    super(MessageType.REQUEST, payload, id);
    this.action = action;
  }

  public toJSON(): IRequest {
    return {
      ...super.toJSON(),
      type: MessageType.REQUEST,
      action: this.action,
    };
  }

  public static fromJSON(data: IRequest): Request {
    return new Request(data.action, data.payload, data.id);
  }
}
