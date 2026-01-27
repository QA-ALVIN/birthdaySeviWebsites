const express = require("express");
const cors = require("cors");
const sql = require("mssql");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const path = require("path");
const port = process.env.PORT || 8080;


app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const dbConfig = {
  server: process.env.DB_SERVER,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERT === "true"
  }
};

let poolPromise;

const getPool = () => {
  if (!poolPromise) {
    if (!dbConfig.server || !dbConfig.user || !dbConfig.password || !dbConfig.database) {
      throw new Error(
        "Database config missing. Create a .env file with DB_SERVER, DB_USER, DB_PASSWORD, DB_DATABASE."
      );
    }
    poolPromise = sql.connect(dbConfig);
  }
  return poolPromise;
};

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/attendees", async (req, res) => {
  const { firstName, lastName, middleName, canAttend } = req.body || {};

  const normalizeName = (value) => (value || "").trim().replace(/\s+/g, " ");
  const normalizedFirst = normalizeName(firstName);
  const normalizedLast = normalizeName(lastName);
  const normalizedMiddle = normalizeName(middleName);

  if (!normalizedFirst || !normalizedLast || typeof canAttend !== "boolean") {
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {
    const pool = await getPool();
    const existing = await pool.request()
      .input("firstName", sql.NVarChar(100), normalizedFirst)
      .input("lastName", sql.NVarChar(100), normalizedLast)
      .query(`
        SELECT COUNT(1) AS Count
        FROM dbo.Attendees
        WHERE LOWER(LTRIM(RTRIM(FirstName))) = LOWER(@firstName)
          AND LOWER(LTRIM(RTRIM(LastName))) = LOWER(@lastName);
      `);

    if (existing.recordset?.[0]?.Count > 0) {
      return res.status(409).json({ error: "User already registered." });
    }

    await pool.request()
      .input("firstName", sql.NVarChar(100), normalizedFirst)
      .input("lastName", sql.NVarChar(100), normalizedLast)
      .input("middleName", sql.NVarChar(100), normalizedMiddle || null)
      .input("canAttend", sql.Bit, canAttend)
      .query(`
        INSERT INTO dbo.Attendees (FirstName, LastName, MiddleName, CanAttend)
        VALUES (@firstName, @lastName, @middleName, @canAttend);
      `);

    return res.status(201).json({ message: "Submitted successfully." });
  } catch (error) {
    console.error("Insert failed:", error);
    const message = error?.message || "Server error";
    return res.status(500).json({ error: message });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
