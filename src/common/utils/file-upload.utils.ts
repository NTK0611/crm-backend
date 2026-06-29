import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

// Only these MIME types are accepted. Any other type is rejected with 400
// before the file reaches your controller.
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// 5MB in bytes
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Memory storage instead of disk storage.
// Why: Cloudinary's upload_stream accepts a Buffer directly.
// With disk storage you'd write to disk, read it back, upload, then delete —
// three unnecessary operations. Memory storage keeps the file in RAM
// as file.buffer, ready to stream straight to Cloudinary.
// Trade-off: large files consume RAM. At 5MB limit this is acceptable.
export const memoryStorageConfig = memoryStorage();

// ─── File type filter ──────────────────────────────────────────────────────
// Unchanged — still validate MIME type before accepting the file.
export const fileTypeFilter = (
  req: any,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(
      new BadRequestException(
        `File type '${file.mimetype}' is not allowed. Allowed types: jpg, png, pdf, docx`,
      ),
      false,
    );
  }
};