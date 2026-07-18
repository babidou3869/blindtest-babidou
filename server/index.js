import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const allowedOrigins = [
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "https://babidou.vercel.app",
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error(`Origine non autorisée : ${origin}`)
      );
    },
  })
);

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    application: "Babidou API",
    version: "1.0.0",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Babidou API démarrée sur le port ${PORT}`);
});