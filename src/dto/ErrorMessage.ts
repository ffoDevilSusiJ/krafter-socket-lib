import { IError, MessageType } from '../types/index.js';
import { Message } from './Message.js';

export class ErrorMessage extends Message implements IError {
  public readonly type: MessageType.ERROR = MessageType.ERROR;
  public readonly code: string;
  public readonly message: string;

  constructor(code: string, message: string, payload?: unknown, id?: string) {
    super(MessageType.ERROR, payload, id);
    this.code = code;
    this.message = message;
  }

  public toJSON(): IError {
    return {
      ...super.toJSON(),
      type: MessageType.ERROR,
      code: this.code,
      message: this.message,
    };
  }

  public static fromJSON(data: IError): ErrorMessage {
    return new ErrorMessage(data.code, data.message, data.payload, data.id);
  }

  public static fromError(error: Error, code: string = 'UNKNOWN_ERROR'): ErrorMessage {
    return new ErrorMessage(code, error.message, { stack: error.stack });
  }
}
