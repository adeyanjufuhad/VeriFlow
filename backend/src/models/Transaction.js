const mongoose = require("mongoose");

const validTransactionTypes = ["income", "expense"];

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, "userId is required"],
      trim: true,
    },
    type: {
      type: String,
      required: [true, "type is required"],
      enum: {
        values: validTransactionTypes,
        message: "type must be either income or expense",
      },
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, "amount is required"],
      min: [0.01, "amount must be greater than 0"],
    },
    currency: {
      type: String,
      default: "NGN",
      uppercase: true,
      trim: true,
    },
    category: {
      type: String,
      required: [true, "category is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "description is required"],
      trim: true,
    },
    transactionDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

const Transaction = mongoose.model("Transaction", transactionSchema);

module.exports = Transaction;
