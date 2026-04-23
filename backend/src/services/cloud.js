const cloudinary = require("cloudinary").v2;
const path = require("path");

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

let isConfigured = false;

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
  isConfigured = true;
  console.log("Cloudinary configured successfully.");
}

async function uploadToCloud(localFilePath, originalName) {
  if (!isConfigured) return null;

  try {
    const result = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "raw", // Needed to handle documents (pdf, docx, etc.) as well as media
      use_filename: true,
      unique_filename: true,
      folder: "converter_outputs",
    });
    return result; // return the entire result object so we can use secure_url and public_id
  } catch (err) {
    console.error("Cloudinary upload failed:", err);
    return null;
  }
}

async function getCloudDownloadUrl(cloudResult) {
  if (!isConfigured || !cloudResult || !cloudResult.secure_url) return null;

  // Force browser download by appending fl_attachment to the Cloudinary URL
  const url = cloudResult.secure_url;
  return url.replace("/upload/", "/upload/fl_attachment/");
}

async function deleteFromCloud(publicId) {
  if (!isConfigured || !publicId) return;
  try {
    // "raw" resource type must be specified for destroy to work on raw files
    await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
  } catch (err) {
    console.error("Cloudinary delete failed:", err);
  }
}

module.exports = {
  uploadToCloud,
  getCloudDownloadUrl,
  deleteFromCloud,
  isCloudConfigured: () => isConfigured,
};
