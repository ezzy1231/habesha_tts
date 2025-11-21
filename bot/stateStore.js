import Redis from 'ioredis';

const normalizeKey = (key) => String(key ?? '');
const isTruthy = (value, defaultValue = false) => {
  if (value === undefined || value === null) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

export const createInMemoryStateStore = () => {
  const store = new Map();

  return {
    getState: (key) => store.get(normalizeKey(key)),
    setState: (key, value) => {
      store.set(normalizeKey(key), value);
      return value;
    },
    clearState: (key) => store.delete(normalizeKey(key)),
    clearAll: () => store.clear(),
    size: () => store.size,
  };
};

const redisUrl = process.env.BOT_STATE_REDIS_URL || process.env.REDIS_URL || null;
const redisEnabled = isTruthy(process.env.BOT_STATE_ENABLE_REDIS, Boolean(redisUrl));
const dualWriteEnabled = isTruthy(process.env.BOT_STATE_DUAL_WRITE, true);
const preferRedisReads = isTruthy(process.env.BOT_STATE_PREFER_REDIS, true);

let redisClient = null;
if (redisEnabled && redisUrl) {
  redisClient = new Redis(redisUrl, {
    enableAutoPipelining: true,
    lazyConnect: true,
    maxRetriesPerRequest: 2,
  });

  redisClient.on('error', (err) => {
    console.error('[Bot][StateStore] Redis error:', err.message);
  });

  redisClient.on('connect', () => {
    console.log('[Bot][StateStore] Redis connection ready.');
  });

  redisClient.connect().catch((err) => {
    console.error('[Bot][StateStore] Failed to connect to Redis. Falling back to memory only.', err.message);
    redisClient = null;
  });
}

const readRedisJson = async (key) => {
  if (!redisClient) return undefined;
  try {
    const value = await redisClient.get(key);
    if (value === null || value === undefined) return undefined;
    return JSON.parse(value);
  } catch (error) {
    console.error('[Bot][StateStore] Failed to read Redis key:', error.message);
    return undefined;
  }
};

const writeRedisJson = async (key, value, ttlSeconds) => {
  if (!redisClient || !dualWriteEnabled) return;
  try {
    const payload = JSON.stringify(value ?? null);
    if (ttlSeconds && Number(ttlSeconds) > 0) {
      await redisClient.set(key, payload, 'EX', Number(ttlSeconds));
    } else {
      await redisClient.set(key, payload);
    }
  } catch (error) {
    console.error('[Bot][StateStore] Failed to write Redis key:', error.message);
  }
};

const deleteRedisKey = async (key) => {
  if (!redisClient || !dualWriteEnabled) return;
  try {
    await redisClient.del(key);
  } catch (error) {
    console.error('[Bot][StateStore] Failed to delete Redis key:', error.message);
  }
};

const clearRedisNamespace = async (pattern) => {
  if (!redisClient || !dualWriteEnabled) return;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (error) {
    console.error('[Bot][StateStore] Failed to clear Redis namespace:', error.message);
  }
};

export const createStateStore = (options = {}) => {
  const {
    namespace = 'bot:state',
    defaultTtlSeconds = Number(process.env.BOT_STATE_DEFAULT_TTL ?? 900),
  } = options;

  const inMemory = createInMemoryStateStore();
  const redisKey = (key) => `${namespace}:${normalizeKey(key)}`;

  const getState = async (key) => {
    if (redisClient && preferRedisReads) {
      const value = await readRedisJson(redisKey(key));
      if (value !== undefined) {
        inMemory.setState(key, value);
        return value;
      }
    }
    return inMemory.getState(key);
  };

  const setState = async (key, value, ttlSeconds = defaultTtlSeconds) => {
    inMemory.setState(key, value);
    await writeRedisJson(redisKey(key), value, ttlSeconds);
    return value;
  };

  const clearState = async (key) => {
    inMemory.clearState(key);
    await deleteRedisKey(redisKey(key));
  };

  const clearAll = async () => {
    inMemory.clearAll();
    await clearRedisNamespace(`${namespace}:*`);
  };

  return {
    get: getState,
    set: setState,
    delete: clearState,
    clearAll,
    getState,
    setState,
    clearState,
    hasRedis: () => Boolean(redisClient),
    inMemorySize: () => inMemory.size(),
  };
};
