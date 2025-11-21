import { ZodError } from 'zod';

/**
 * Returns an Express middleware that validates the specified request segment
 * against the provided Zod schema. Responds with HTTP 400 when validation fails.
 */
export const validateSchema = (schema, { source = 'body', strip = true } = {}) => {
  return (req, res, next) => {
    try {
      const payload = req?.[source] ?? {};
      const parsed = schema.parse(payload);
      if (strip) {
        req[source] = parsed;
      }
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const firstIssue = error.issues?.[0];
        return res.status(400).json({ error: firstIssue?.message || 'Invalid request payload' });
      }
      return res.status(500).json({ error: 'Failed to validate request payload' });
    }
  };
};
