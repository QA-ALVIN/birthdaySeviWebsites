const express = require("express");
const cors = require("cors");
const sql = require("mssql");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const path = require("path");
const host = process.env.HOST || "127.0.0.1";

const parsePort = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return null;
  }
  return parsed;
};

const configuredPort = parsePort(process.env.PORT) ?? 8080;
const candidatePorts = [...new Set([configuredPort, 5050, 5051, 3000, 4000])];


app.use(cors());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  next();
});
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

app.get("/api/attendees", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT FirstName, LastName, MiddleName, CanAttend
      FROM dbo.Attendees
      ORDER BY LastName, FirstName;
    `);

    const attendees = (result.recordset || []).map((row) => ({
      firstName: (row.FirstName || "").trim(),
      lastName: (row.LastName || "").trim(),
      middleName: (row.MiddleName || "").trim(),
      canAttend: Boolean(row.CanAttend)
    }));

    return res.json({ attendees });
  } catch (error) {
    console.error("Fetch attendees failed:", error);
    return res.status(500).json({ error: error?.message || "Server error" });
  }
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
      return res.status(409).json({ error: "already registered." });
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

const listenWithFallback = (index = 0) => {
  const port = candidatePorts[index];

  const server = app.listen(port, host, () => {
    console.log(`API listening on http://${host}:${port}`);
  });

  server.on("error", (error) => {
    const canRetry = (error?.code === "EACCES" || error?.code === "EADDRINUSE")
      && index < candidatePorts.length - 1;

    if (canRetry) {
      const nextPort = candidatePorts[index + 1];
      console.warn(`Port ${port} unavailable (${error.code}). Trying ${nextPort}...`);
      listenWithFallback(index + 1);
      return;
    }

    console.error(`Failed to start API on ${host}:${port}`, error);
    process.exit(1);
  });
};

listenWithFallback();
