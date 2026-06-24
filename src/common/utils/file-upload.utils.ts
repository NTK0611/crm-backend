import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';


// Only these MIME types are accepted. Any other type is rejected with 400
// before the file is written to disk — multer checks this during upload.
const ALLOWED_MIME_TYPES = [
  'image/jpeg',   // .jpg
  'image/png',    // .png
  'application/pdf',  // .pdf
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
];


// 5MB in bytes — multer uses bytes, not megabytes
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB


// Controls WHERE files are saved and WHAT they are named.
// Using disk storage (not memory storage) because:
// - Memory storage holds the entire file in RAM — bad for large files
// - Disk storage writes directly to the filesystem
export const diskStorageConfig = diskStorage({
  destination: './uploads',
  // Filename strategy: uuid + original extension
  // Why uuid? If two users upload "photo.jpg", without uuid they would
  // overwrite each other. UUID guarantees uniqueness.
  filename: (req, file, callback) => {
    const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
    callback(null, uniqueName);
  },
});

// ─── File type filter ──────────────────────────────────────────────────────
// Multer calls this function for every uploaded file.
// If we call callback(null, true) → file is accepted
// If we call callback(error, false) → file is rejected


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