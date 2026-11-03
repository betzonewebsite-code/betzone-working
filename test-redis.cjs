const Redis = require("ioredis");
require("dotenv").config();

const redis = new Redis(process.env.REDIS_URL, {
  connectTimeout: 10000,
  maxRetriesPerRequest: 1
});

redis.ping()
  .then(result => console.log("REDIS CONNECTION SUCCESS:", result))
  .catch(error => console.log("REDIS CONNECTION FAILED:", error.message))
  .finally(() => redis.disconnect());
