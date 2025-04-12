const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "import",
  password: "tanvi",
  port: 5432,
});

module.exports = pool;
