// src/routes/expenseRoutes.ts
import { Router } from "express";
import * as expenseController from "../controllers/expenseController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

/**
 * Expense Management Routes
 * All routes are protected with JWT authentication
 */
router.get("/", authMiddleware, expenseController.getExpenses);
router.get("/group/:groupId", authMiddleware, expenseController.getGroupExpenses);
router.get("/:id", authMiddleware, expenseController.getExpenseById);
router.post("/", authMiddleware, expenseController.createExpense);
router.patch("/:id", authMiddleware, expenseController.updateExpense);
router.delete("/:id", authMiddleware, expenseController.deleteExpense);

export default router;

