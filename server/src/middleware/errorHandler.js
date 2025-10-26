module.exports = function errorHandler(err, req, res, next) {
  console.error('Error:', err?.message || err);
  if (process.env.NODE_ENV !== 'production' && err?.stack) {
    console.error(err.stack);
  }
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal Server Error' });
};
