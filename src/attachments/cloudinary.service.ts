import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private readonly configService: ConfigService) {
    // Configure Cloudinary SDK with credentials from environment variables.
    // This runs once when the service is instantiated.
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  // Upload a file buffer to Cloudinary.
  // Returns a promise that resolves to the full Cloudinary response,
  // which includes secure_url (the permanent public URL) and public_id.
  uploadBuffer(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      // Determine resource_type so Cloudinary handles the file correctly:
      // - 'image' → jpg, png (Cloudinary applies image optimizations)
      // - 'raw'   → pdf, docx (binary files, no image processing)
      const resourceType = mimeType.startsWith('image/') ? 'image' : 'raw';

      // upload_stream is Cloudinary's streaming upload API.
      // It accepts a Node.js Readable stream, not a Buffer directly.
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: resourceType,
          folder: 'crm-attachments',
          // Store files in a dedicated folder in your Cloudinary account
          // Makes it easier to manage/delete files later
          use_filename: true,
          unique_filename: true,
          // Cloudinary appends a unique suffix — prevents name collisions
        },
        (error, result) => {
          if (error) {
            this.logger.error(`Cloudinary upload failed: ${error.message}`);
            reject(error);
          } else {
            this.logger.log(`File uploaded to Cloudinary: ${result!.secure_url}`);
            resolve(result!);
          }
        },
      );

      // Convert Buffer → Readable stream → pipe into Cloudinary upload stream
      const readable = new Readable();
      readable.push(buffer);
      readable.push(null); // null signals end of stream
      readable.pipe(uploadStream);
    });
  }
}