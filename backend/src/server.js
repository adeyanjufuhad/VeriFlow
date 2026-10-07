require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { connectDatabase } = require("./config/database");
const transactionRoutes = require("./routes/transactionRoutes");
const healthRoutes = require("./routes/healthRoutes");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());

app.use("/api", healthRoutes);
app.use("/api/transactions", transactionRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  await connectDatabase();

  app.listen(PORT, () => {
    console.log(`Financial backend running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Server failed to start:", error.message);
  process.exit(1);
});
