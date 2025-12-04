import { Request, Response } from '../dto';
import { ClientConnection } from './ClientConnection';

export type RequestHandlerFunction = (
  request: Request,
  client: ClientConnection
) => Promise<Response> | Response;

export class RequestHandler {
  private handlers: Map<string, RequestHandlerFunction>;

  constructor() {
    this.handlers = new Map();
  }

  public register(action: string, handler: RequestHandlerFunction): void {
    if (this.handlers.has(action)) {
      throw new Error(`Handler for action '${action}' is already registered`);
    }
    this.handlers.set(action, handler);
  }

  public unregister(action: string): boolean {
    return this.handlers.delete(action);
  }

  public async handle(request: Request, client: ClientConnection): Promise<Response> {
    const handler = this.handlers.get(request.action);

    if (!handler) {
      return Response.error(
        request.id,
        { code: 'UNKNOWN_ACTION', message: `Unknown action: ${request.action}` }
      );
    }

    try {
      const result = await handler(request, client);
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred';
      return Response.error(request.id, {
        code: 'HANDLER_ERROR',
        message: errorMessage,
      });
    }
  }

  public hasHandler(action: string): boolean {
    return this.handlers.has(action);
  }

  public getRegisteredActions(): string[] {
    return Array.from(this.handlers.keys());
  }
}
