import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { CloudinaryService } from './cloudinary.service';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

@Controller('upload')
export class UploadController {
  constructor(private readonly cloudinary: CloudinaryService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Headers('x-yaemart-brand') brandHeader?: string,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('multipart field "file" is required');
    }
    if (!ALLOWED.has(file.mimetype)) {
      throw new BadRequestException(`unsupported type: ${file.mimetype}`);
    }
    const brand = brandHeader?.trim() || 'homtone';
    const url = await this.cloudinary.uploadBuffer(file.buffer, brand);
    return { url };
  }
}
