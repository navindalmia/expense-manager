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
router.post("/", authMiddleware, expenseController.createExpense);
router.delete("/:id", authMiddleware, expenseController.deleteExpense);

export default router;

