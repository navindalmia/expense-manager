// src/app.ts
import express from "express";
import cors from "cors";
import expenseRoutes from "./routes/expenseRoutes";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/expenses", expenseRoutes);

// Health check
app.get("/", (req, res) => res.send("Expense Manager API running ✅"));

// Error handling (fallback)
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

export default app;
