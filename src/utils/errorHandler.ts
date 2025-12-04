import { ErrorMessage } from '../dto';
import { Logger } from './logger';

export interface IErrorHandlerConfig {
  logger?: Logger;
  includeStack?: boolean;
}

export class ErrorHandler {
  private logger: Logger;
  private includeStack: boolean;

  constructor(config: IErrorHandlerConfig = {}) {
    this.logger = config.logger || new Logger();
    this.includeStack = config.includeStack !== false;
  }

  public handleError(error: unknown, context?: string): ErrorMessage {
    const errorMessage = this.parseError(error);

    const logContext = context ? ` in ${context}` : '';
    this.logger.error(`Error occurred${logContext}`, error);

    return errorMessage;
  }

  private parseError(error: unknown): ErrorMessage {
    if (error instanceof ErrorMessage) {
      return error;
    }

    if (error instanceof Error) {
      const payload = this.includeStack ? { stack: error.stack } : undefined;
      return new ErrorMessage('ERROR', error.message, payload);
    }

    if (typeof error === 'string') {
      return new ErrorMessage('ERROR', error);
    }

    if (typeof error === 'object' && error !== null) {
      const err = error as any;
      const code = err.code || 'UNKNOWN_ERROR';
      const message = err.message || 'An unknown error occurred';
      return new ErrorMessage(code, message, this.includeStack ? error : undefined);
    }

    return new ErrorMessage('UNKNOWN_ERROR', 'An unknown error occurred', { error });
  }

  public static createValidationError(message: string): ErrorMessage {
    return new ErrorMessage('VALIDATION_ERROR', message);
  }

  public static createNotFoundError(resource: string): ErrorMessage {
    return new ErrorMessage('NOT_FOUND', `${resource} not found`);
  }

  public static createUnauthorizedError(message: string = 'Unauthorized'): ErrorMessage {
    return new ErrorMessage('UNAUTHORIZED', message);
  }

  public static createTimeoutError(operation: string): ErrorMessage {
    return new ErrorMessage('TIMEOUT', `${operation} timed out`);
  }
}
