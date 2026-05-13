import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { memoryStorage } from "multer";

import { UploadController } from "./upload.controller";
import { UploadService } from "./upload.service";

const ALLOWED_MIMES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
];

@Module({
  imports: [
    MulterModule.register({
      // Hold file in RAM only — we stream it straight to Cloudinary, no disk write.
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        if (ALLOWED_MIMES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error(`File type ${file.mimetype} is not allowed`), false);
        }
      },
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    }),
  ],
  providers: [UploadService],
  controllers: [UploadController],
})
export class UploadModule {}
