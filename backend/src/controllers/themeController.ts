/**
 * Theme Controller
 *
 * HTTP handlers for Theme listing and management.
 */

import { Request, Response, NextFunction } from 'express';
import * as themeService from '../services/themeService';
import { validateThemeNameInput } from '../schemas/themeSchema';

export async function getThemes(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const themes = await themeService.listThemes(userId);

    res.status(200).json({ statusCode: 200, data: themes });
  } catch (error) {
    next(error);
  }
}

export async function createTheme(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = validateThemeNameInput(req.body);
    const userId = req.user!.id;

    const theme = await themeService.createTheme(userId, validated.name);

    res.status(201).json({ statusCode: 201, data: theme });
  } catch (error) {
    next(error);
  }
}

export async function renameTheme(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = validateThemeNameInput(req.body);
    const userId = req.user!.id;
    const themeId = Number(req.params.id);

    const theme = await themeService.renameTheme(userId, themeId, validated.name);

    res.status(200).json({ statusCode: 200, data: theme });
  } catch (error) {
    next(error);
  }
}

export async function disableTheme(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const themeId = Number(req.params.id);

    const theme = await themeService.disableTheme(userId, themeId);

    res.status(200).json({ statusCode: 200, data: theme });
  } catch (error) {
    next(error);
  }
}
