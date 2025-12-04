import { IEvent, MessageType } from '../types';
import { Message } from './Message';

export class Event extends Message implements IEvent {
  public readonly type: MessageType.EVENT = MessageType.EVENT;
  public readonly eventName: string;

  constructor(eventName: string, payload: unknown, id?: string) {
    super(MessageType.EVENT, payload, id);
    this.eventName = eventName;
  }

  public toJSON(): IEvent {
    return {
      ...super.toJSON(),
      type: MessageType.EVENT,
      eventName: this.eventName,
    };
  }

  public static fromJSON(data: IEvent): Event {
    return new Event(data.eventName, data.payload, data.id);
  }
}
