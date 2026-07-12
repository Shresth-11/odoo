import knex from "knex";
import path from "path";
const config = require("../../knexfile");
const knexConfig = config.default || config;

const environment = process.env.NODE_ENV || "development";
const db = knex(knexConfig[environment]);

export default db;
export { db };
