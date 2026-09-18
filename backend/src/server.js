require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const prisma = require("./config/prisma");

const authRoutes = require("./routes/authRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const studyRoutes = require("./routes/studyRoutes");

const app = express();

const PORT = process.env.PORT || 5000;


/*
====================================================
MIDDLEWARE
====================================================
*/

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

app.use(cookieParser());


/*
====================================================
ROOT
====================================================
*/

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "GATE CSE Tracker API is running",
  });
});


/*
====================================================
HEALTH CHECK
====================================================
*/

app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      success: true,
      database: "connected",
    });
  } catch (error) {
    console.error("Database error:", error);

    res.status(500).json({
      success: false,
      database: "disconnected",
    });
  }
});


/*
====================================================
AUTH ROUTES
====================================================
*/

app.use("/api/auth", authRoutes);


/*
====================================================
STUDY SESSION ROUTES
====================================================
*/

app.use("/api/sessions", sessionRoutes);


/*
====================================================
STUDY DATA ROUTES
====================================================
*/

app.use("/api/study", studyRoutes);


/*
====================================================
START SERVER
====================================================
*/

async function startServer() {
  try {
    await prisma.$connect();

    console.log("PostgreSQL connected successfully");

    app.listen(PORT, () => {
      console.log(
        `GATE CSE API running on http://localhost:${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "Failed to connect to PostgreSQL:",
      error
    );

    process.exit(1);
  }
}

startServer();


/*
====================================================
GRACEFUL SHUTDOWN
====================================================
*/

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});