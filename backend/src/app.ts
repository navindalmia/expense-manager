// src/app.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import expenseRoutes from "./routes/expenseRoutes";
import groupRoutes from "./routes/groupRoutes";
import authRoutes from "./routes/authRoutes";
import categoryRoutes from "./routes/categoryRoutes";
import currencyRoutes from "./routes/currencyRoutes";
import themeRoutes from "./routes/themeRoutes";
import labelRoutes from "./routes/labelRoutes";
import internalRoutes from "./routes/internalRoutes"; // Internal/test endpoints
import { errorHandler } from "./middlewares/errorHandler"; 
import { i18nMiddleware } from "./middlewares/i18nMiddleware";
import { buildCorsOptions } from "./config/cors";
import { areInternalRoutesEnabled } from "./config/env";
import "./types/express"; // Import JWT type extensions

const app = express();

// Trust proxy: Render terminates TLS in front of the app (one proxy hop), so
// req.ip must come from X-Forwarded-For for per-IP rate limiting to work.
// Elsewhere (local dev, tests) do not trust the header, since a client could
// spoof it. Override the hop count with TRUST_PROXY (a non-negative integer).
const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY ?? "", 10);
if (Number.isInteger(trustProxyHops) && trustProxyHops >= 0) {
  app.set("trust proxy", trustProxyHops);
} else if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Middleware
app.use(helmet());
app.use(cors(buildCorsOptions()));
app.use(express.json());
app.use(i18nMiddleware); // Language detection middleware added here

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/currencies", currencyRoutes);
app.use("/api/themes", themeRoutes);
app.use("/api/labels", labelRoutes);

// Internal/Test routes: non-production AND explicit ENABLE_INTERNAL_ROUTES=true
if (areInternalRoutesEnabled()) {
  app.use("/api/internal", internalRoutes);
}

// Health check
app.get("/", (req, res) => res.send("Expense Manager API running "));

// Error handling (fallback)
// app.use((err: any, req: any, res: any, next: any) => {
//   console.error("Unhandled error:", err);
//   res.status(500).json({ error: "Internal Server Error" });
// });
app.use(errorHandler);

export default app;
