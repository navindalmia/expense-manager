/**
 * Label Controller
 *
 * HTTP handlers for Label listing, management, and per-label totals.
 */

import { Request, Response, NextFunction } from 'express';
import * as labelService from '../services/labelService';
import { validateLabelNameInput } from '../schemas/labelSchema';

export async function getLabels(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const labels = await labelService.listLabels(userId);

    res.status(200).json({ statusCode: 200, data: labels });
  } catch (error) {
    next(error);
  }
}

export async function createLabel(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = validateLabelNameInput(req.body);
    const userId = req.user!.id;

    const label = await labelService.createLabel(userId, validated.name);

    res.status(201).json({ statusCode: 201, data: label });
  } catch (error) {
    next(error);
  }
}

export async function disableLabel(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const labelId = Number(req.params.id);

    const label = await labelService.disableLabel(userId, labelId);

    res.status(200).json({ statusCode: 200, data: label });
  } catch (error) {
    next(error);
  }
}

export async function getLabelTotals(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const totals = await labelService.getLabelTotals(userId);

    res.status(200).json({ statusCode: 200, data: totals });
  } catch (error) {
    next(error);
  }
}
