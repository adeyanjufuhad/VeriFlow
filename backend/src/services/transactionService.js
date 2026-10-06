const Transaction = require("../models/Transaction");

async function createTransaction(data) {
  const transaction = new Transaction(data);
  return await transaction.save();
}

async function getTransactions({ userId, type, page = 1, limit = 20 }) {
  const query = {};

  if (userId) query.userId = userId;
  if (type) query.type = type;

  const pageNumber = Math.max(1, Number(page) || 1);
  const limitNumber = Math.max(1, Number(limit) || 20);
  const skip = (pageNumber - 1) * limitNumber;

  const [transactions, total] = await Promise.all([
    Transaction.find(query)
      .sort({ transactionDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .lean(),
    Transaction.countDocuments(query),
  ]);

  return {
    transactions,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber) || 1,
    },
  };
}

async function getTransactionById(id) {
  return await Transaction.findById(id).lean();
}

async function deleteTransaction(id) {
  return await Transaction.findByIdAndDelete(id);
}

async function updateTransaction(id, data) {
  return await Transaction.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  }).lean();
}

async function getSummary(userId) {
  const match = {};
  if (userId) match.userId = userId;

  const result = await Transaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalIncome: {
          $sum: {
            $cond: [{ $eq: ["$type", "income"] }, "$amount", 0],
          },
        },
        totalExpenses: {
          $sum: {
            $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0],
          },
        },
        transactionCount: { $sum: 1 },
      },
    },
  ]);

  if (!result[0]) {
    return {
      totalIncome: 0,
      totalExpenses: 0,
      balance: 0,
      transactionCount: 0,
    };
  }

  const summary = result[0];
  return {
    totalIncome: Number(summary.totalIncome || 0),
    totalExpenses: Number(summary.totalExpenses || 0),
    balance:
      Number(summary.totalIncome || 0) - Number(summary.totalExpenses || 0),
    transactionCount: Number(summary.transactionCount || 0),
  };
}

module.exports = {
  createTransaction,
  getTransactions,
  getTransactionById,
  deleteTransaction,
  updateTransaction,
  getSummary,
};
