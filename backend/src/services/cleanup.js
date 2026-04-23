const fs = require("fs");
const path = require("path");
const cron = require("node-cron");

const uploadsDir = path.join(__dirname, "..", "..", "uploads");
const outputsDir = path.join(__dirname, "..", "..", "outputs");

function cleanDirectory(dirPath, maxAgeMs) {
  if (!fs.existsSync(dirPath)) return;
  const now = Date.now();
  const files = fs.readdirSync(dirPath);
  let deletedCount = 0;

  files.forEach((file) => {
    const filePath = path.join(dirPath, file);
    try {
      const stats = fs.statSync(filePath);
      if (stats.isFile() && (now - stats.mtimeMs > maxAgeMs)) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    } catch (err) {
      console.error(`Failed to stat/delete file ${filePath}:`, err.message);
    }
  });
  
  if (deletedCount > 0) {
    console.log(`Cleaned ${deletedCount} files from ${dirPath}`);
  }
}

// Default max age: 3 hours
const MAX_AGE_MS = 3 * 60 * 60 * 1000;

function runCleanup() {
  console.log("Running scheduled file cleanup...");
  cleanDirectory(uploadsDir, MAX_AGE_MS);
  cleanDirectory(outputsDir, MAX_AGE_MS);
}

// Run cleanup every hour at minute 0
cron.schedule("0 * * * *", runCleanup);

module.exports = {
  runCleanup
};
