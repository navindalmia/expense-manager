// src/routes/expenseRoutes.ts
import { Router } from "express";
import * as expenseController from "../controllers/expenseController";

const router = Router();

router.get("/", expenseController.getExpenses);
router.post("/", expenseController.createExpense);
router.delete("/:id", expenseController.deleteExpense);

export default router;

