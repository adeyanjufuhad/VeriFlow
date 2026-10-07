const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let memoryServer;

async function connectDatabase() {
  try {
    let mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      memoryServer = await MongoMemoryServer.create();
      mongoUri = memoryServer.getUri();
      console.log(
        "MongoDB uri not found. Using in-memory MongoDB for local development.",
      );
    }

    await mongoose.connect(mongoUri, {
      dbName: process.env.DB_NAME || "financial_backend",
    });

    console.log(
      `MongoDB connected successfully at ${mongoose.connection.host}`,
    );
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

module.exports = { connectDatabase };
