const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * Local Disk Upload Utility
 * 
 * Configures multer to save file uploads directly to the local disk
 * (public/uploads directory). Bypasses cloud storage entirely.
 * 
 * Constraints:
 *   - Allowed formats: JPEG, PNG, WebP
 *   - Max file size: 5 MB
 */

// Ensure the upload directory exists
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up storage engine
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const patientId = req.user?._id || 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    // Example: unknown-1698765432100-meal.jpg
    cb(null, `${patientId}-${timestamp}-${safeName}${ext}`);
  }
});

// Allowed MIME types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function fileFilter(req, file, cb) {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, and WebP images are allowed.`), false);
  }
}

const uploadMealPhoto = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB
  }
});

/**
 * Reads an image from the local disk as a Buffer.
 * Used by the Vision API to analyze images locally.
 * 
 * @param {string} localPath - The relative path or filename
 * @returns {Promise<Buffer>} The image data as a Buffer
 */
async function getImageBuffer(localPath) {
  // Extract filename from URL/path if necessary
  const filename = path.basename(localPath);
  const fullPath = path.join(uploadDir, filename);
  return fs.promises.readFile(fullPath);
}

module.exports = { uploadMealPhoto, getImageBuffer };
