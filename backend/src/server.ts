
import dotenv from "dotenv";
import app from "./app";
import { errorHandler } from "./middlewares/errorHandler";

dotenv.config();

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
