export default function errorHandler(err, req, res, next) {
  console.error('Error:', err?.message || err);
  if (process.env.NODE_ENV !== 'production' && err?.stack) {
    console.error(err.stack);
  }
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  const clientMessage =
    process.env.NODE_ENV === 'production' && status === 500
      ? 'Internal Server Error'
      : message;
  res.status(status).json({ error: clientMessage });
}
