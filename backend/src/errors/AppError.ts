
import i18next from "../utils/i18n";

export class AppError extends Error {
  statusCode: number;
  code?: string|undefined;
  messageKey: string; 
  details?: unknown;


  constructor(messageKey: string, statusCode = 400, code?: string, details?: unknown ) {

    super(messageKey);
    this.statusCode = statusCode;
    this.code = code;
    this.messageKey=messageKey;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}
