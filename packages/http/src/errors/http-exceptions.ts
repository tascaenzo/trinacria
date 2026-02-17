import {
  HttpException,
  type HttpExceptionOptions,
  type HttpExceptionResponse,
} from "./http-exception";

class NamedHttpException extends HttpException {
  constructor(
    name: string,
    status: number,
    response: HttpExceptionResponse,
    options?: HttpExceptionOptions,
  ) {
    super(response, status, options);
    this.name = name;
  }
}

export class BadRequestException extends NamedHttpException {
  constructor(
    response: HttpExceptionResponse = "Bad Request",
    options?: HttpExceptionOptions,
  ) {
    super("BadRequestException", 400, response, options);
  }
}

export class UnauthorizedException extends NamedHttpException {
  constructor(
    response: HttpExceptionResponse = "Unauthorized",
    options?: HttpExceptionOptions,
  ) {
    super("UnauthorizedException", 401, response, options);
  }
}

export class ForbiddenException extends NamedHttpException {
  constructor(
    response: HttpExceptionResponse = "Forbidden",
    options?: HttpExceptionOptions,
  ) {
    super("ForbiddenException", 403, response, options);
  }
}

export class NotFoundException extends NamedHttpException {
  constructor(
    response: HttpExceptionResponse = "Not Found",
    options?: HttpExceptionOptions,
  ) {
    super("NotFoundException", 404, response, options);
  }
}

export class MethodNotAllowedException extends NamedHttpException {
  constructor(
    allowedMethods: string[] = [],
    response: HttpExceptionResponse = "Method Not Allowed",
    options: HttpExceptionOptions = {},
  ) {
    const allowHeader: Record<string, string> | undefined =
      allowedMethods.length > 0
        ? { allow: allowedMethods.join(", ") }
        : undefined;

    super("MethodNotAllowedException", 405, response, {
      ...options,
      headers: { ...(allowHeader ?? {}), ...(options.headers ?? {}) },
    });
  }
}

export class ConflictException extends NamedHttpException {
  constructor(
    response: HttpExceptionResponse = "Conflict",
    options?: HttpExceptionOptions,
  ) {
    super("ConflictException", 409, response, options);
  }
}

export class PayloadTooLargeException extends NamedHttpException {
  constructor(
    response: HttpExceptionResponse = "Payload Too Large",
    options?: HttpExceptionOptions,
  ) {
    super("PayloadTooLargeException", 413, response, options);
  }
}

export class UnprocessableEntityException extends NamedHttpException {
  constructor(
    response: HttpExceptionResponse = "Unprocessable Entity",
    options?: HttpExceptionOptions,
  ) {
    super("UnprocessableEntityException", 422, response, options);
  }
}

export class TooManyRequestsException extends NamedHttpException {
  constructor(
    response: HttpExceptionResponse = "Too Many Requests",
    options?: HttpExceptionOptions,
  ) {
    super("TooManyRequestsException", 429, response, options);
  }
}

export class InternalServerErrorException extends NamedHttpException {
  constructor(
    response: HttpExceptionResponse = "Internal Server Error",
    options?: HttpExceptionOptions,
  ) {
    super("InternalServerErrorException", 500, response, options);
  }
}

export class ServiceUnavailableException extends NamedHttpException {
  constructor(
    response: HttpExceptionResponse = "Service Unavailable",
    options?: HttpExceptionOptions,
  ) {
    super("ServiceUnavailableException", 503, response, options);
  }
}
