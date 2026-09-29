// Express 4 doesn't catch rejected promises from async route handlers on its own —
// an unhandled rejection there just hangs the request. Wrap every async handler in
// this so DB errors reach the error middleware instead.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
