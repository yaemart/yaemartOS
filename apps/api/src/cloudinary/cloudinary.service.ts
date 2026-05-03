import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

export interface CloudinaryUploadResult {
  publicId: string;
  secureUrl: string;
}

@Injectable()
export class CloudinaryService {
  constructor(private readonly config: ConfigService) {
    cloudinary.config({
      cloud_name: this.config.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.config.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.config.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  /** Upload image buffer to legacy path `yaemartos/{brand}/`. Returns secure HTTPS URL. */
  uploadBuffer(buffer: Buffer, brand: string): Promise<string> {
    const folder = `yaemartos/${brand}`;
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image' },
        (err, result) => {
          if (err || !result?.secure_url) {
            reject(err ?? new Error('Cloudinary upload failed'));
            return;
          }
          resolve(result.secure_url);
        },
      );
      stream.end(buffer);
    });
  }

  /**
   * Upload a raw file (PDF, doc, etc.) with public access.
   * Folder: `{env}/{brand}/{assetType}/{identifier}`
   */
  uploadRaw(
    buffer: Buffer,
    brand: string,
    assetType: string,
    identifier: string,
  ): Promise<CloudinaryUploadResult> {
    const env = this.config.get<string>('NODE_ENV') ?? 'development';
    const folder = `${env}/${brand}/${assetType}/${identifier}`;
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'raw', access_mode: 'public' },
        (err, result) => {
          if (err || !result) {
            reject(err ?? new Error('Cloudinary raw upload failed'));
            return;
          }
          resolve({ publicId: result.public_id, secureUrl: result.secure_url });
        },
      );
      stream.end(buffer);
    });
  }

  /**
   * Upload a private file (warranty invoices, etc.) with authenticated access.
   * Folder: `{env}/{brand}/{assetType}/{identifier}`
   * Use `signUrl()` to generate a time-limited access URL.
   */
  uploadPrivate(
    buffer: Buffer,
    brand: string,
    assetType: string,
    identifier: string,
  ): Promise<CloudinaryUploadResult> {
    const env = this.config.get<string>('NODE_ENV') ?? 'development';
    const folder = `${env}/${brand}/${assetType}/${identifier}`;
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'raw', access_mode: 'authenticated', type: 'authenticated' },
        (err, result) => {
          if (err || !result) {
            reject(err ?? new Error('Cloudinary private upload failed'));
            return;
          }
          resolve({ publicId: result.public_id, secureUrl: result.secure_url });
        },
      );
      stream.end(buffer);
    });
  }

  /**
   * Generate a signed time-limited URL for an authenticated asset.
   * @param publicId  Cloudinary public_id returned by uploadPrivate()
   * @param ttlSec    URL lifetime in seconds (default: 7 days)
   */
  signUrl(publicId: string, ttlSec = 7 * 24 * 3600): string {
    const expireAt = Math.floor(Date.now() / 1000) + ttlSec;
    return cloudinary.url(publicId, {
      resource_type: 'raw',
      type: 'authenticated',
      sign_url: true,
      expires_at: expireAt,
      secure: true,
    });
  }
}
