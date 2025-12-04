import { IEventRoute } from '../types';

export class EventParser {
  /**
   * Парсит строку события в формате serviceName:module:name
   * Например: "stickyNotes:note:move"
   */
  public static parseEventType(eventType: string): IEventRoute | null {
    const parts = eventType.split(':');

    if (parts.length !== 3) {
      return null;
    }

    const [serviceName, module, eventName] = parts;

    if (!serviceName || !module || !eventName) {
      return null;
    }

    return {
      serviceName,
      module,
      eventName,
    };
  }

  /**
   * Форматирует событие в строку формата serviceName:module:name
   */
  public static formatEventType(serviceName: string, module: string, eventName: string): string {
    return `${serviceName}:${module}:${eventName}`;
  }

  /**
   * Проверяет, что eventType соответствует формату serviceName:module:name
   */
  public static isValidEventFormat(eventType: string): boolean {
    return this.parseEventType(eventType) !== null;
  }

  /**
   * Извлекает serviceName из eventType
   */
  public static getServiceName(eventType: string): string | null {
    const parsed = this.parseEventType(eventType);
    return parsed ? parsed.serviceName : null;
  }
}
