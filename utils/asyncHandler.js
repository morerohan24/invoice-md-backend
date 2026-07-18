// Express 4 doesn't catch rejected promises from async route handlers on its
// own — an unhandled rejection would just hang the request. Wrapping every
// async handler in this forwards errors to the error-handling middleware in
// server.js instead.
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
