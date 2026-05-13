import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  UploadApiErrorResponse,
  UploadApiResponse,
  v2 as cloudinary,
} from "cloudinary";

export type UploadedFileResult = {
  url: string;
  publicId: string;
  resourceType: "image" | "video" | "raw";
  format: string;
  width?: number;
  height?: number;
  bytes: number;
  originalName: string;
  mimetype: string;
};

@Injectable()
export class UploadService implements OnModuleInit {
  private readonly logger = new Logger(UploadService.name);
  private configured = false;
  private folder = "halo";

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const cloudName = this.configService.get<string>("CLOUDINARY_CLOUD_NAME");
    const apiKey = this.configService.get<string>("CLOUDINARY_API_KEY");
    const apiSecret = this.configService.get<string>("CLOUDINARY_API_SECRET");
    this.folder =
      this.configService.get<string>("CLOUDINARY_FOLDER") || "halo";

    if (!cloudName || !apiKey || !apiSecret) {
      this.logger.error(
        "Cloudinary credentials missing — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env. File uploads will fail until configured."
      );
      return;
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    this.configured = true;
    this.logger.log(
      `Cloudinary configured (cloud=${cloudName}, folder=${this.folder})`
    );
  }

  async processAndSaveFile(
    file: Express.Multer.File
  ): Promise<UploadedFileResult> {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }
    if (!this.configured) {
      throw new InternalServerErrorException(
        "Cloudinary is not configured on the server"
      );
    }

    const resourceType: "image" | "video" = file.mimetype.startsWith("video/")
      ? "video"
      : "image";

    const result = await this.uploadBuffer(
      file.buffer,
      resourceType,
      file.originalname
    );

    this.logger.log(
      `Uploaded ${file.originalname} (${file.size}b ${file.mimetype}) → ${result.secure_url}`
    );

    return {
      url: result.secure_url,
      publicId: result.public_id,
      resourceType: result.resource_type as UploadedFileResult["resourceType"],
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      originalName: file.originalname,
      mimetype: file.mimetype,
    };
  }

  private uploadBuffer(
    buffer: Buffer,
    resourceType: "image" | "video",
    filename: string
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: resourceType,
          folder: this.folder,
          use_filename: true,
          unique_filename: true,
          overwrite: false,
          ...(resourceType === "video"
            ? { eager_async: true, eager: [{ format: "mp4", quality: "auto" }] }
            : {}),
        },
        (
          error: UploadApiErrorResponse | undefined,
          uploaded: UploadApiResponse | undefined
        ) => {
          if (error || !uploaded) {
            this.logger.error(
              `Cloudinary upload failed for ${filename}: ${error?.message}`
            );
            return reject(
              new InternalServerErrorException(
                `Upload failed: ${error?.message ?? "unknown"}`
              )
            );
          }
          resolve(uploaded);
        }
      );
      stream.end(buffer);
    });
  }

  /**
   * Delete an asset from Cloudinary. Call this when a post/message is deleted
   * to avoid leaving orphaned media. Not wired into controllers yet.
   */
  async destroy(
    publicId: string,
    resourceType: "image" | "video" = "image"
  ): Promise<void> {
    if (!this.configured) return;
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
    } catch (e: any) {
      this.logger.warn(
        `Failed to delete Cloudinary asset ${publicId}: ${e?.message}`
      );
    }
  }
}
