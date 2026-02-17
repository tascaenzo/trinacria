import { STATUS_CODES } from "node:http";
import type { HttpContext } from "../server/http-context";
import { HttpException } from "./http-exception";
import {
  BadRequestException,
  InternalServerErrorException,
} from "./http-exceptions";

export interface SerializedHttpError {
  status: number;
  headers?: Record<string, string>;
  body: unknown;
}

export type HttpExceptionHandler = (
  error: unknown,
  _ctx: HttpContext,
) => SerializedHttpError;

export const defaultExceptionHandler: HttpExceptionHandler = (error) => {
  if (error instanceof HttpException) {
    return serializeHttpException(error);
  }

  if (error instanceof URIError) {
    return serializeHttpException(new BadRequestException("Malformed URL"));
  }

  return serializeHttpException(new InternalServerErrorException());
};

function serializeHttpException(exception: HttpException): SerializedHttpError {
  const status = exception.getStatus();
  const response = exception.getResponse();

  if (typeof response === "string") {
    return {
      status,
      headers: exception.headers,
      body: {
        statusCode: status,
        message: response,
        error: STATUS_CODES[status] ?? "Error",
        code: exception.code,
        details: exception.details,
      },
    };
  }

  return {
    status,
    headers: exception.headers,
    body: {
      statusCode: status,
      ...response,
      code: exception.code,
      details: exception.details,
    },
  };
}
