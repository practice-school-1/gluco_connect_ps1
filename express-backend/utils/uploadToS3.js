const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');

/**
 * S3/R2 Upload Utility
 * 
 * Configures multer to stream file uploads directly to AWS S3 (or
 * Cloudflare R2 — same SDK, just set AWS_ENDPOINT in .env).
 * 
 * Also provides getImageBuffer() for downloading images from S3 via the
 * SDK (not HTTP), which works regardless of whether the bucket is public
 * or private. This is used by the Vision API integration.
 * 
 * Constraints:
 *   - Allowed formats: JPEG, PNG, WebP
 *   - Max file size: 5 MB
 *   - Storage key: meals/{patientId}/{timestamp}-{originalname}
 */

// Initialize the S3 client
// For Cloudflare R2, set AWS_ENDPOINT to your R2 endpoint URL.
// For standard AWS S3, leave AWS_ENDPOINT unset.
const s3Config = {
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
};

// If a custom endpoint is provided (e.g., Cloudflare R2), add it
if (process.env.AWS_ENDPOINT) {
  s3Config.endpoint = process.env.AWS_ENDPOINT;
  s3Config.forcePathStyle = true; // Required for R2 and MinIO compatibility
}

const s3 = new S3Client(s3Config);

// Allowed MIME types for meal photos
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * File filter — rejects any file that isn't JPEG, PNG, or WebP.
 */
function fileFilter(req, file, cb) {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, and WebP images are allowed.`), false);
  }
}

/**
 * Pre-configured multer middleware for meal photo uploads.
 * 
 * Usage in a route:
 *   const { uploadMealPhoto } = require('../utils/uploadToS3');
 *   router.post('/photo', uploadMealPhoto.single('photo'), handler);
 * 
 * After upload, the file URL is available at `req.file.location`.
 */
const uploadMealPhoto = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.S3_BUCKET_NAME,
    // Set content type to auto-detect from the file
    contentType: multerS3.AUTO_CONTENT_TYPE,
    // Generate a unique key for each upload
    key: function (req, file, cb) {
      const patientId = req.user?._id || 'unknown';
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
      cb(null, `meals/${patientId}/${timestamp}-${safeName}${ext}`);
    }
  }),
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB
  }
});

/**
 * Extract the S3 object key from a full S3/R2 URL.
 * 
 * Handles both URL styles:
 *   - Virtual-hosted: https://bucket.s3.region.amazonaws.com/meals/id/file.jpg
 *   - Path-style:     https://s3.region.amazonaws.com/bucket/meals/id/file.jpg
 *   - R2:             https://bucket.account.r2.cloudflarestorage.com/meals/id/file.jpg
 * 
 * In all cases, the key is the URL pathname minus the leading '/'.
 * 
 * @param {string} photoUrl - Full S3/R2 URL
 * @returns {string} The S3 object key
 */
function extractS3Key(photoUrl) {
  const url = new URL(photoUrl);
  // Remove leading '/' from pathname to get the key
  return decodeURIComponent(url.pathname.substring(1));
}

/**
 * Download an image from S3/R2 as a Buffer using the AWS SDK.
 * 
 * This works regardless of whether the bucket is public or private,
 * because it uses SDK credentials (not HTTP) to access the object.
 * Used by the Vision API to analyze images without requiring public URLs.
 * 
 * @param {string} photoUrl - The full S3/R2 URL of the image
 * @returns {Buffer} The image data as a Buffer
 * @throws {Error} If the download fails
 */
async function getImageBuffer(photoUrl) {
  const key = extractS3Key(photoUrl);

  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key
  });

  const response = await s3.send(command);

  // Convert the readable stream to a Buffer
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

module.exports = { uploadMealPhoto, getImageBuffer, s3 };
