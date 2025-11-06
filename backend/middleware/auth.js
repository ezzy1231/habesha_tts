import db from '../db-postgres.js';

export const protectStreamer = async (req, res, next) => {
  const apiKey = req.headers.authorization?.split(' ')[1]; // Expects "Bearer <key>"
  const { uuid } = req.params;

  if (!apiKey) {
    return res.status(401).json({ error: 'Unauthorized: No API key provided.' });
  }

  if (!uuid) {
    return res.status(400).json({ error: 'Bad Request: Streamer UUID is missing.' });
  }

  try {
    const streamerRes = await db.query(
      'SELECT telegram_id FROM users WHERE link_uuid = $1 AND api_key = $2 AND role = \'streamer\'',
      [uuid, apiKey]
    );

    const streamer = streamerRes.rows[0];

    if (!streamer) {
      return res.status(403).json({ error: 'Forbidden: Invalid API key or UUID.' });
    }

    // Attach the streamer's telegram_id to the request object for use in subsequent handlers
    req.streamerId = streamer.telegram_id;
    next();
  } catch (error) {
    console.error('Error in authentication middleware:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
