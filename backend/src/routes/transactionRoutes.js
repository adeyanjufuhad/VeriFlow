const express = require("express");
const transactionController = require("../controllers/transactionController");

const router = express.Router();

router.post("/", transactionController.createTransaction);
router.get("/", transactionController.getTransactions);
router.get("/summary", transactionController.getSummary);
router.get("/:id", transactionController.getTransactionById);
router.put("/:id", transactionController.updateTransaction);
router.patch("/:id", transactionController.updateTransaction);
router.delete("/:id", transactionController.deleteTransaction);

module.exports = router;
