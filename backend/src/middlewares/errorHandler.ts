
import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError";
import i18next from "../utils/i18n";

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error("Error caught:", err);

  const lang = (req as any).language || "en";

  let message = err.message;

  // Translate known keys (e.g., "EXPENSE.SPLIT_SUM_MISMATCH")
  if (typeof message === "string" && message.includes(".")) {
    const translation = i18next.t(message, { lng: lang });
    if (translation !== message) message = translation;
  }
console.error("Error message before translation:", err.message);
console.log("Current language:", (req as any).language);
console.log("Translation attempt:", i18next.t(err.message, { lng: (req as any).language }));
  // Handle known AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: message,
      code: err.code,
    });
  }

  // Handle generic errors
  res.status(500).json({
    error: i18next.t("GENERAL.INTERNAL_SERVER_ERROR", { lng: lang }) || "Internal server error",
  });
}
