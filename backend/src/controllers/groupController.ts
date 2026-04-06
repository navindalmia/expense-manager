/**
 * Group Controller
 * 
 * HTTP request handlers for group management.
 * Validates input, calls service layer, and returns JSON responses.
 */

import { Request, Response, NextFunction } from 'express';
import * as groupService from '../services/groupService';
import { validateGroupInput } from '../schemas/groupSchema';

/**
 * Create a new group
 * POST /api/groups
 */
export async function createGroup(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const validated = validateGroupInput(req.body);
    
    // Get userId from JWT token via auth middleware
    const userId = req.user!.id

    const group = await groupService.createGroup({
      name: validated.name,
      description: validated.description,
      createdById: userId,
      currency: validated.currency,
    });

    res.status(201).json({
      success: true,
      data: group,
      message: 'Group created successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all groups for current user
 * GET /api/groups
 */
export async function getGroups(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Get userId from JWT token via auth middleware
    const userId = req.user!.id

    const groups = await groupService.getUserGroups(userId);

    res.status(200).json({
      success: true,
      data: groups,
      count: groups.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single group by ID
 * GET /api/groups/:id
 */
export async function getGroupById(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Group ID is required',
      });
    }
    const groupId = parseInt(id, 10);

    if (isNaN(groupId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid group ID',
      });
    }

    // Get userId from JWT token via auth middleware
    const userId = req.user!.id

    const group = await groupService.getGroupById(groupId, userId);

    res.status(200).json({
      success: true,
      data: group,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Add member to group
 * POST /api/groups/:id/members
 */
export async function addMember(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Group ID is required',
      });
    }
    const { memberId } = req.body;
    const groupId = parseInt(id, 10);

    if (isNaN(groupId) || !memberId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid group ID or member ID',
      });
    }

    // Get userId from JWT token via auth middleware
    const userId = req.user!.id

    const group = await groupService.addMemberToGroup(groupId, memberId, userId);

    res.status(200).json({
      success: true,
      data: group,
      message: 'Member added successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete/deactivate group
 * DELETE /api/groups/:id
 */
export async function deleteGroup(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Group ID is required',
      });
    }
    const groupId = parseInt(id, 10);

    if (isNaN(groupId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid group ID',
      });
    }

    // Get userId from JWT token via auth middleware
    const userId = req.user!.id

    const group = await groupService.deactivateGroup(groupId, userId);

    res.status(200).json({
      success: true,
      data: group,
      message: 'Group deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get group statistics
 * GET /api/groups/:id/stats
 */
export async function getStats(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Group ID is required',
      });
    }
    const groupId = parseInt(id, 10);

    if (isNaN(groupId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid group ID',
      });
    }

    // Get userId from JWT token via auth middleware
    const userId = req.user!.id

    const stats = await groupService.getGroupStats(groupId, userId);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get expenses for a specific group
 * GET /api/groups/:id/expenses
 */
export async function getGroupExpenses(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const groupId = parseInt(id, 10);

    if (isNaN(groupId)) {
      throw new Error('Invalid group ID');
    }

    // Get userId from JWT token via auth middleware
    const userId = req.user!.id

    const expenses = await groupService.getGroupExpenses(groupId, userId);

    res.status(200).json({
      success: true,
      data: expenses,
      count: expenses.length,
    });
  } catch (error) {
    next(error); // Let error middleware handle all errors consistently
  }
}
