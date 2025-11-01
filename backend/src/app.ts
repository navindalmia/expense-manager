// src/app.ts
import express from "express";
import cors from "cors";
import expenseRoutes from "./routes/expenseRoutes";
import { errorHandler } from "./middlewares/errorHandler"; 
import { i18nMiddleware } from "./middlewares/i18nMiddleware";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(i18nMiddleware); // Language detection middleware added here

// Routes
app.use("/api/expenses", expenseRoutes);

// Health check
app.get("/", (req, res) => res.send("Expense Manager API running "));

// Error handling (fallback)
// app.use((err: any, req: any, res: any, next: any) => {
//   console.error("Unhandled error:", err);
//   res.status(500).json({ error: "Internal Server Error" });
// });
app.use(errorHandler);

export default app;
