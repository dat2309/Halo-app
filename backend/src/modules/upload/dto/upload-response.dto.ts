import { ApiProperty } from "@nestjs/swagger";

export class UploadResponseDto {
  @ApiProperty({
    description: "Public HTTPS URL of the uploaded asset (Cloudinary CDN)",
    example:
      "https://res.cloudinary.com/<cloud>/image/upload/v123456/halo/abc123.jpg",
  })
  url: string;

  @ApiProperty({
    description:
      "Cloudinary public_id. Use this to delete or transform the asset later.",
    example: "halo/abc123",
  })
  publicId: string;

  @ApiProperty({
    enum: ["image", "video", "raw"],
    description: "Type of resource as classified by Cloudinary",
    example: "image",
  })
  resourceType: "image" | "video" | "raw";

  @ApiProperty({
    description: "File format (jpg, png, mp4, webm, ...)",
    example: "jpg",
  })
  format: string;

  @ApiProperty({
    required: false,
    description: "Image/video width in pixels",
    example: 1080,
  })
  width?: number;

  @ApiProperty({
    required: false,
    description: "Image/video height in pixels",
    example: 1920,
  })
  height?: number;

  @ApiProperty({
    description: "Size in bytes (after Cloudinary processing if any)",
    example: 102400,
  })
  bytes: number;

  @ApiProperty({
    description: "Original filename submitted by the client",
    example: "my-image.jpg",
  })
  originalName: string;

  @ApiProperty({
    description: "Original MIME type sent by the client",
    example: "image/jpeg",
  })
  mimetype: string;
}
