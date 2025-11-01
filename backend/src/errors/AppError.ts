
import i18next from "../utils/i18n";

export class AppError extends Error {
  statusCode: number;
  code?: string|undefined;
  messageKey: string; 


  constructor(messageKey: string, statusCode = 400, code?: string) {

    super(messageKey);
    this.statusCode = statusCode;
    this.code = code;
    this.messageKey=messageKey;

    Error.captureStackTrace(this, this.constructor);
  }
}
