/**
 * Group Routes
 * 
 * All routes for group management (create, list, delete, add members).
 * Includes proper error handling and request validation.
 */

import { Router } from 'express';
import * as groupController from '../controllers/groupController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

/**
 * Group Management Routes
 * NOTE: All routes are protected with JWT authentication
 * Specific routes (:id/stats) must come BEFORE generic routes (:id)
 */

// Create a new group
// POST /api/groups
router.post('/', authMiddleware, groupController.createGroup);

// Get all groups for current user
// GET /api/groups
router.get('/', authMiddleware, groupController.getGroups);

// Get group statistics (specific route BEFORE generic :id)
// GET /api/groups/:id/stats
router.get('/:id/stats', authMiddleware, groupController.getStats);

// NOTE: Group expenses now accessed via GET /api/expenses/group/:groupId
// (consolidated endpoint with proper authorization checks)

// Get a specific group (generic route AFTER specific ones)
// GET /api/groups/:id
router.get('/:id', authMiddleware, groupController.getGroupById);

// Add member to group by email (specific route BEFORE generic)
// POST /api/groups/:id/members/email
router.post('/:id/members/email', authMiddleware, groupController.addMemberByEmail);

// Add member to group by ID
// POST /api/groups/:id/members
router.post('/:id/members', authMiddleware, groupController.addMember);

// Remove member from group
// DELETE /api/groups/:id/members/:memberId
router.delete('/:id/members/:memberId', authMiddleware, groupController.removeMember);

// Update/edit a group
// PATCH /api/groups/:id
router.patch('/:id', authMiddleware, groupController.updateGroup);

// Delete/deactivate group
// DELETE /api/groups/:id
router.delete('/:id', authMiddleware, groupController.deleteGroup);

export default router;
