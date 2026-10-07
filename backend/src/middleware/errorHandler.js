function notFoundHandler(req, res) {
  return res.status(404).json({ error: "Route not found" });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const isValidationError =
    err.name === "ValidationError" || err.name === "CastError";
  const statusCode =
    err.statusCode ||
    (isValidationError ? 400 : err.code === 11000 ? 409 : 500);
  const message = err.message || "Internal server error";

  return res.status(statusCode).json({
    error: message,
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
