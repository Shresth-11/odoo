import type { Knex } from "knex";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, ".env") });

const config: { [key: string]: Knex.Config } = {
  development: {
    client: "pg",
    connection: {
      host: process.env.DB_HOST || "127.0.0.1",
      port: parseInt(process.env.DB_PORT || "5432"),
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
      database: process.env.DB_NAME || "assetflow",
    },
    acquireConnectionTimeout: 60000,
    migrations: {
      directory: path.join(__dirname, "src/db/migrations"),
      extension: "ts",
    },
    seeds: {
      directory: path.join(__dirname, "src/db/seeds"),
      extension: "ts",
    },
  },
  production: {
    client: "pg",
    connection: process.env.DATABASE_URL
      ? {
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false },
        }
      : {
          host: process.env.DB_HOST,
          port: parseInt(process.env.DB_PORT || "5432"),
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
          ssl: { rejectUnauthorized: false },
        },
    acquireConnectionTimeout: 60000,
    migrations: {
      directory: path.join(__dirname, "src/db/migrations"),
      extension: "ts",
    },
    seeds: {
      directory: path.join(__dirname, "src/db/seeds"),
      extension: "ts",
    },
  },
};

export default config;
