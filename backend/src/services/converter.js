const fs = require("fs");
const path = require("path");
const libre = require("libreoffice-convert");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const XLSX = require("xlsx");
const pdfParse = require("pdf-parse");

libre.convertWithOptionsAsync = require("util").promisify(libre.convertWithOptions);

async function officeConvert(sourcePath, outputPath, targetExt, sourceExt) {
  try {
    const input = await fs.promises.readFile(sourcePath);
    let options = {};
    if (sourceExt === 'pdf') {
      options.sofficeAdditionalArgs = ['--infilter=writer_pdf_import'];
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
}

function mediaConvert(sourcePath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(sourcePath)
      .output(outputPath)
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
  await sharp(sourcePath).toFile(outputPath);
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
  mp3: ["mp4", "wav"],
  wav: ["mp3", "mp4"],
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
