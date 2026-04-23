require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const session = require("express-session");
const cors = require("cors");
const { MongoStore } = require("connect-mongo");
const { convertFile, getSupportedTargets } = require("./services/converter");
const { uploadToCloud, getCloudDownloadUrl, isCloudConfigured } = require("./services/cloud");
const Conversion = require("./models/Conversion");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
require("./services/cleanup"); // Starts cron job

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/converter";
let isMongoReady = false;

const uploadsDir = path.join(__dirname, "..", "uploads");
const outputsDir = path.join(__dirname, "..", "outputs");
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(outputsDir, { recursive: true });

const libreOfficeProgramDir =
  process.env.LIBREOFFICE_PATH || "C:\\Program Files\\LibreOffice\\program";
if (fs.existsSync(path.join(libreOfficeProgramDir, "soffice.exe"))) {
  const pathEntries = (process.env.PATH || "").split(path.delimiter);
  if (!pathEntries.includes(libreOfficeProgramDir)) {
    process.env.PATH = `${libreOfficeProgramDir}${path.delimiter}${process.env.PATH || ""}`;
    console.log("LibreOffice path injected for converter process");
  }
}

app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

app.set("trust proxy", 1); // Trust Render's reverse proxy

app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretkey123",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGODB_URI }),
    cookie: { 
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      sameSite: "none",
      secure: true 
    },
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

mongoose
  .connect(MONGODB_URI, { serverSelectionTimeoutMS: 3000 })
  .then(() => {
    isMongoReady = true;
    console.log("MongoDB connected");
  })
  .catch((error) => {
    isMongoReady = false;
    console.error("MongoDB connection failed:", error.message);
  });

mongoose.connection.on("connected", () => {
  isMongoReady = true;
});
mongoose.connection.on("disconnected", () => {
  isMongoReady = false;
});
mongoose.connection.on("error", () => {
  isMongoReady = false;
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/[^\w.-]/g, "_")}`;
    cb(null, safeName);
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max per file
});
const MAX_CONVERSION_MS = Number(process.env.MAX_CONVERSION_MS || 180000);

async function safeLogConversion(payload) {
  if (!isMongoReady) {
    return;
  }
  try {
    await Conversion.create(payload);
  } catch (error) {
    console.error("Conversion log write failed:", error.message);
  }
}

function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function getErrorMessage(error) {
  if (!error) return "Unknown conversion error";
  if (typeof error === "string") return error;
  if (error.message && typeof error.message === "string") return error.message;
  try {
    return JSON.stringify(error);
  } catch (_e) {
    return "Unknown conversion error";
  }
}

async function ensureOutputReady(filePath) {
  try {
    const stats = await fs.promises.stat(filePath);
    if (!stats.isFile() || stats.size <= 0) {
      throw new Error("Converted file is empty.");
    }
  } catch (error) {
    throw new Error(`Converted file is missing or unreadable: ${getErrorMessage(error)}`);
  }
}

app.get("/api/conversions", async (req, res) => {
  if (!isMongoReady || !req.session.userId) {
    return res.json([]);
  }
  try {
    const items = await Conversion.find({ userId: req.session.userId }).sort({ createdAt: -1 }).limit(20).lean();
    res.json(items);
  } catch (error) {
    console.error("Could not load conversion history:", error.message);
    res.json([]);
  }
});

app.get("/api/supported-targets/:sourceExt", (req, res) => {
  const sourceExt = (req.params.sourceExt || "").toLowerCase().trim();
  res.json({ sourceExt, targets: getSupportedTargets(sourceExt) });
});

app.post("/api/convert", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Please upload a file." });
  }

  let target = (req.body.target || "").toLowerCase().trim();
  if (target === "docs") {
    target = "docx";
  }
  if (!target) {
    return res.status(400).json({ error: "Target format is required." });
  }

  const sourceExt = path.extname(req.file.originalname).replace(".", "").toLowerCase();
  const safeBase = path.basename(req.file.filename, path.extname(req.file.filename));
  const outputPath = path.join(outputsDir, `${safeBase}.${target}`);

  try {
    const result = await withTimeout(
      convertFile({
        sourcePath: req.file.path,
        sourceExt,
        targetExt: target,
        outputPath,
      }),
      MAX_CONVERSION_MS,
      `Conversion timed out after ${Math.floor(MAX_CONVERSION_MS / 1000)}s`
    );
    await ensureOutputReady(result.outputPath);

    if (isCloudConfigured()) {
      const outputFileName = `${path.parse(req.file.originalname).name}.${target}`;
      const [cloudResult] = await Promise.all([
        uploadToCloud(result.outputPath, outputFileName),
        safeLogConversion({
          inputName: req.file.originalname,
          sourceExt,
          targetExt: target,
          outputName: path.basename(result.outputPath),
          status: "success",
          message: "Converted successfully",
          userId: req.session.userId || null
        }).catch(() => {})
      ]);
      const downloadUrl = await getCloudDownloadUrl(cloudResult);
      if (!downloadUrl) {
        return res.status(500).json({ error: "Cloud upload failed. Please try again." });
      }
      res.json({ downloadUrl, outputName: outputFileName });
    } else {
      await safeLogConversion({
        inputName: req.file.originalname,
        sourceExt,
        targetExt: target,
        outputName: path.basename(result.outputPath),
        status: "success",
        message: "Converted successfully",
        userId: req.session.userId || null
      }).catch(() => {});
      res.download(result.outputPath, `${path.parse(req.file.originalname).name}.${target}`, (err) => {
        if (err) console.error("Download error:", err.message);
      });
    }
  } catch (error) {
    const message = getErrorMessage(error);
    try {
      await safeLogConversion({
        inputName: req.file.originalname,
        sourceExt,
        targetExt: target,
        outputName: "",
        status: "failed",
        message,
        userId: req.session.userId || null
      });
    } catch (logError) {
      console.error("Failure log skipped:", getErrorMessage(logError));
    }

    console.error("Conversion failed:", message);
    res.status(500).json({ error: message });
  }
});

app.use((error, _req, res, _next) => {
  const message = getErrorMessage(error);
  console.error("Unhandled route error:", message);
  if (res.headersSent) {
    return;
  }
  res.status(500).json({ error: message });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
