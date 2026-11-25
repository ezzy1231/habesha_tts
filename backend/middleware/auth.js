import { authorizeStreamerRequest } from '../utils/streamerIdentity.js';

// Streamer routes: Authorization: Bearer <API key or login token>, or the login cookie.
export const protectStreamer = async (req, res, next) => {
  const { uuid } = req.params;
  if (!uuid) return res.status(400).json({ error: 'Bad Request: Streamer UUID is missing.' });
  const hasCredential = req.headers.authorization?.startsWith('Bearer ') || /(?:^|;\s*)authToken=/.test(req.headers.cookie || '');
  if (!hasCredential) return res.status(401).json({ error: 'Unauthorized: No API key provided.' });
  try {
    const streamerId = await authorizeStreamerRequest(req, uuid);
    if (!streamerId) return res.status(403).json({ error: 'Forbidden: Invalid API key or UUID.' });
    req.streamerId = streamerId;
    return next();
  } catch (error) {
    console.error('Error in authentication middleware:', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
