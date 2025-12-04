export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface ILoggerConfig {
  level: LogLevel;
  prefix?: string;
  enableTimestamp?: boolean;
}

export class Logger {
  private config: ILoggerConfig;

  constructor(config: Partial<ILoggerConfig> = {}) {
    this.config = {
      level: config.level || LogLevel.INFO,
      prefix: config.prefix || '[SocketLib]',
      enableTimestamp: config.enableTimestamp !== false,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, message: string, meta?: unknown): string {
    const parts: string[] = [];

    if (this.config.enableTimestamp) {
      parts.push(`[${new Date().toISOString()}]`);
    }

    parts.push(this.config.prefix || '');
    parts.push(`[${level.toUpperCase()}]`);
    parts.push(message);

    if (meta !== undefined) {
      parts.push(JSON.stringify(meta, null, 2));
    }

    return parts.join(' ');
  }

  public debug(message: string, meta?: unknown): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, meta));
    }
  }

  public info(message: string, meta?: unknown): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage(LogLevel.INFO, message, meta));
    }
  }

  public warn(message: string, meta?: unknown): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message, meta));
    }
  }

  public error(message: string, error?: Error | unknown): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(LogLevel.ERROR, message, error));
    }
  }

  public setLevel(level: LogLevel): void {
    this.config.level = level;
  }
}
