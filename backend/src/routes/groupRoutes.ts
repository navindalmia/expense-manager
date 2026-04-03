/**
 * Group Routes
 * 
 * All routes for group management (create, list, delete, add members).
 * Includes proper error handling and request validation.
 */

import { Router } from 'express';
import * as groupController from '../controllers/groupController';

const router = Router();

/**
 * Group Management Routes
 * NOTE: Specific routes (:id/stats) must come BEFORE generic routes (:id)
 */

// Create a new group
// POST /api/groups
router.post('/', groupController.createGroup);

// Get all groups for current user
// GET /api/groups
router.get('/', groupController.getGroups);

// Get group statistics (specific route BEFORE generic :id)
// GET /api/groups/:id/stats
router.get('/:id/stats', groupController.getStats);

// Get a specific group (generic route AFTER specific ones)
// GET /api/groups/:id
router.get('/:id', groupController.getGroupById);

// Add member to group
// POST /api/groups/:id/members
router.post('/:id/members', groupController.addMember);

// Delete/deactivate group
// DELETE /api/groups/:id
router.delete('/:id', groupController.deleteGroup);

export default router;
