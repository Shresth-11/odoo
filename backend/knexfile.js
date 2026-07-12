const path = require("path");

const connection = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    }
  : {
      host: process.env.DB_HOST || "127.0.0.1",
      port: parseInt(process.env.DB_PORT || "5432"),
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
      database: process.env.DB_NAME || "assetflow",
    };

module.exports = {
  development: {
    client: "pg",
    connection,
    acquireConnectionTimeout: 60000,
    migrations: {
      directory: path.join(__dirname, "dist/db/migrations"),
      extension: "js",
    },
    seeds: {
      directory: path.join(__dirname, "dist/db/seeds"),
      extension: "js",
    },
  },
  production: {
    client: "pg",
    connection,
    acquireConnectionTimeout: 60000,
    migrations: {
      directory: path.join(__dirname, "dist/db/migrations"),
      extension: "js",
    },
    seeds: {
      directory: path.join(__dirname, "dist/db/seeds"),
      extension: "js",
    },
  },
};
