const transactionService = require("../services/transactionService");

async function createTransaction(req, res, next) {
  try {
    const payload = req.body;

    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Request body is required" });
    }

    const transaction = await transactionService.createTransaction(payload);
    return res.status(201).json(transaction);
  } catch (error) {
    next(error);
  }
}

async function getTransactions(req, res, next) {
  try {
    const { userId, type, page, limit } = req.query;

    const result = await transactionService.getTransactions({
      userId,
      type,
      page,
      limit,
    });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function getTransactionById(req, res, next) {
  try {
    const { id } = req.params;
    const transaction = await transactionService.getTransactionById(id);

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    return res.status(200).json(transaction);
  } catch (error) {
    next(error);
  }
}

async function deleteTransaction(req, res, next) {
  try {
    const { id } = req.params;
    const transaction = await transactionService.deleteTransaction(id);

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    return res
      .status(200)
      .json({ message: "Transaction deleted successfully" });
  } catch (error) {
    next(error);
  }
}

async function updateTransaction(req, res, next) {
  try {
    const payload = req.body;

    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      Object.keys(payload).length === 0
    ) {
      return res
        .status(400)
        .json({ error: "A non-empty request body is required" });
    }

    const transaction = await transactionService.updateTransaction(
      req.params.id,
      payload,
    );

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    return res.status(200).json(transaction);
  } catch (error) {
    next(error);
  }
}

async function getSummary(req, res, next) {
  try {
    const { userId } = req.query;
    const summary = await transactionService.getSummary(userId || null);
    return res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createTransaction,
  getTransactions,
  getTransactionById,
  deleteTransaction,
  updateTransaction,
  getSummary,
};
