import { ApiProperty } from '@nestjs/swagger';

// This DTO is not used for request body validation the usual way.
// File uploads use multipart/form-data, not JSON — class-validator
// decorators don't work on the file field itself because the file
// is handled by multer, not the NestJS validation pipe.
// This DTO exists purely for Swagger documentation — it tells Swagger
// to render a file upload input in the UI instead of a JSON body field.

export class UploadAttachmentDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'File to upload (jpg, png, pdf, docx — max 5MB)',
  })
  file: any;
}