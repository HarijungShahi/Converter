const fs = require("fs");
const path = require("path");
const util = require("util");
const libre = require("libreoffice-convert");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const XLSX = require("xlsx");
const pdfParse = require("pdf-parse");

libre.convertWithOptionsAsync = util.promisify(libre.convertWithOptions);

// LibreOffice can only run one conversion at a time — queue them
let officeQueue = Promise.resolve();
function queueOfficeConvert(fn) {
  officeQueue = officeQueue.then(() => fn()).catch(() => fn());
  return officeQueue;
}

// Clean up LibreOffice lock files that can cause hangs on Render
async function clearLibreOfficeLocks() {
  try {
    const tmpDir = "/tmp";
    const entries = await fs.promises.readdir(tmpDir).catch(() => []);
    await Promise.all(
      entries
        .filter((e) => e.startsWith(".~lock") || e.startsWith("lu") || e.includes("libreoffice"))
        .map((e) => fs.promises.rm(path.join(tmpDir, e), { recursive: true, force: true }).catch(() => {}))
    );
  } catch (_) {}
}

async function officeConvert(sourcePath, outputPath, targetExt, sourceExt) {
  return queueOfficeConvert(async () => {
    await clearLibreOfficeLocks();
    try {
      const input = await fs.promises.readFile(sourcePath);
      let options = {};
      if (sourceExt === "pdf") {
        options.sofficeAdditionalArgs = ["--infilter=writer_pdf_import"];
      }
      const done = await libre.convertWithOptionsAsync(input, `.${targetExt}`, undefined, options);
      await fs.promises.writeFile(outputPath, done);
      return outputPath;
    } catch (error) {
      const message = (error && error.message) || String(error || "");
      if (/ENOENT|soffice/i.test(message)) {
        throw new Error(
          "LibreOffice is not installed or not found in PATH. Install LibreOffice and restart the server."
        );
      }
      throw new Error(`Office conversion failed: ${message}`);
    }
  });
}

function mediaConvert(sourcePath, outputPath) {
  return new Promise((resolve, reject) => {
    const ext = path.extname(outputPath).replace(".", "").toLowerCase();
    let cmd = ffmpeg(sourcePath).output(outputPath);

    // Use fast preset for video, skip video stream for audio-only outputs
    if (["mp3", "wav"].includes(ext)) {
      cmd = cmd.noVideo();
    } else {
      cmd = cmd.outputOptions(["-preset ultrafast", "-crf 28"]);
    }

    cmd
      .on("end", () => resolve(outputPath))
      .on("error", (error) => {
        const message = (error && error.message) || String(error || "");
        if (/ffmpeg/i.test(message)) {
          reject(
            new Error(
              "FFmpeg is not installed or not found in PATH. Install FFmpeg and restart the server."
            )
          );
          return;
        }
        reject(new Error(`Media conversion failed: ${message}`));
      })
      .run();
  });
}

async function pdfToExcel(sourcePath, outputPath) {
  const data = await fs.promises.readFile(sourcePath);
  const parsed = await pdfParse(data);
  const rows = parsed.text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => [line]);

  const sheet = XLSX.utils.aoa_to_sheet([["Extracted Text"], ...rows]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "PDF Data");
  XLSX.writeFile(book, outputPath);
  return outputPath;
}

async function imageConvert(sourcePath, outputPath) {
  const ext = path.extname(outputPath).replace(".", "").toLowerCase();
  let pipeline = sharp(sourcePath, { failOnError: false });

  if (ext === "jpg" || ext === "jpeg") {
    pipeline = pipeline.jpeg({ quality: 85, mozjpeg: true });
  } else if (ext === "png") {
    pipeline = pipeline.png({ compressionLevel: 6 });
  } else if (ext === "webp") {
    pipeline = pipeline.webp({ quality: 85 });
  } else if (ext === "tiff" || ext === "tif") {
    pipeline = pipeline.tiff({ compression: "lzw" });
  }

  await pipeline.toFile(outputPath);
  return outputPath;
}

const supportedMap = {
  pdf: ["docx", "doc", "xlsx"],
  doc: ["pdf"],
  docx: ["pdf"],
  png: ["jpg", "jpeg", "webp", "tiff"],
  jpg: ["png", "webp", "tiff"],
  jpeg: ["png", "webp", "tiff"],
  webp: ["png", "jpg", "jpeg", "tiff"],
  tiff: ["png", "jpg", "jpeg", "webp"],
  gif: ["png", "jpg", "jpeg", "webp"],
  bmp: ["png", "jpg", "jpeg", "webp"],
  mp4: ["mp3", "wav", "webm", "avi", "mkv"],
  mp3: ["wav"],
  wav: ["mp3"],
  avi: ["mp4", "mp3", "webm"],
  mkv: ["mp4", "mp3", "webm"],
  webm: ["mp4", "mp3", "avi", "mkv"]
};

function getSupportedTargets(sourceExt) {
  return supportedMap[sourceExt] || [];
}

function ensureSupported(sourceExt, targetExt) {
  const targets = getSupportedTargets(sourceExt);
  if (!targets.includes(targetExt)) {
    throw new Error(`Unsupported conversion: ${sourceExt} to ${targetExt}`);
  }
}

async function convertFile({ sourcePath, sourceExt, targetExt, outputPath }) {
  ensureSupported(sourceExt, targetExt);

  if (
    (sourceExt === "pdf" && targetExt === "docx") ||
    (sourceExt === "pdf" && targetExt === "doc") ||
    (sourceExt === "docx" && targetExt === "pdf") ||
    (sourceExt === "doc" && targetExt === "pdf")
  ) {
    return { outputPath: await officeConvert(sourcePath, outputPath, targetExt, sourceExt) };
  }

  if (sourceExt === "pdf" && targetExt === "xlsx") {
    return { outputPath: await pdfToExcel(sourcePath, outputPath) };
  }

  if (["png", "jpg", "jpeg", "webp", "tiff", "gif", "bmp"].includes(sourceExt)) {
    return { outputPath: await imageConvert(sourcePath, outputPath) };
  }

  const mediaExts = ["mp4", "mp3", "wav", "avi", "mkv", "webm"];
  if (mediaExts.includes(sourceExt) && mediaExts.includes(targetExt)) {
    return { outputPath: await mediaConvert(sourcePath, outputPath) };
  }

  throw new Error(`Converter not implemented for ${sourceExt} to ${targetExt}`);
}

module.exports = { convertFile, getSupportedTargets, supportedMap };
