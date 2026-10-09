export const requireApiKey = (envVarName, fallback) => (req, res, next) => {
  const expected = process.env[envVarName] || fallback;
  if (req.headers["x-api-key"] !== expected) {
    return res.status(401).json({ error: "Invalid API key" });
  }
  next();
};
