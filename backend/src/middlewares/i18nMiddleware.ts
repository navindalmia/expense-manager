
import { Request, Response, NextFunction } from "express";
import i18next from "../utils/i18n";



export function i18nMiddleware(req: Request, res: Response, next: NextFunction) {
  let preferredLang = "fr"; // fallback

  const rawHeader = req.headers["accept-language"];
  console.log("rawHeader:"+rawHeader);
  const headerStr = typeof rawHeader === "string"
    ? rawHeader
    : Array.isArray(rawHeader) && typeof rawHeader[0] === "string"
    ? rawHeader[0]
    : undefined;
  console.log("headerStr:"+headerStr);
  if (headerStr) {
    const parts = headerStr.split(",");
    if (parts.length > 0 && parts[0]) {
      preferredLang = parts[0].trim();
    }
  }

  const preload = i18next.options?.preload;
  
  console.log("preload:"+preload);
  const availableLanguages = Array.isArray(preload) ? preload as string[] : ["en"];
  const chosenLang = availableLanguages.includes(preferredLang) ? preferredLang : "en";

  (req as any).language = chosenLang;
  
  console.log("chosenLang:"+chosenLang);
  i18next.changeLanguage(chosenLang);

  next();
}


