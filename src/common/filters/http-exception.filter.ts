import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res: Response = ctx.getResponse();
    const req: Request = ctx.getRequest();

    // If the response was already committed (e.g. a redirect was issued before throwing),
    // there is nothing we can do — just bail out to avoid "headers already sent" errors.
    if (res.headersSent) return;

    const user = (req as any).user;

    let status = 500;
    let message = 'Internal server error';
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse() as any;
      message = typeof r === 'string' ? r : (r?.message ?? exception.message);
    } else {
      this.log.error(exception);
    }

    // Pick template by status; fall through to 500 for anything unmapped
    let template = 'pages/errors/500';
    if (status === 403) template = 'pages/errors/403';
    else if (status === 404) template = 'pages/errors/404';
    else if (status < 500) {
      // 4xx that isn't 403/404: return JSON (keeps existing e2e tests happy for BadRequest validation errors)
      return res.status(status).json({ statusCode: status, message });
    }

    return res.status(status).render(template, {
      title: `Error ${status}`, layout: 'layouts/main', user, isAdmin: user?.role === 'admin', message,
    });
  }
}
