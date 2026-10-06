const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

router.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

module.exports = router;
