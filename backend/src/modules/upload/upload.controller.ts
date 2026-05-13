import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Express } from "express";
import { SuccessResponseDto } from "../../common/responses/api-response.dto";
import { UploadResponseDto } from "./dto/upload-response.dto";
import { UploadService } from "./upload.service";

@ApiTags("Upload")
@ApiBearerAuth("JWT-auth")
@Controller("upload")
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "Upload a file" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: "File uploaded successfully",
    type: SuccessResponseDto(UploadResponseDto),
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const fileData = await this.uploadService.processAndSaveFile(file);
    return {
      success: true,
      data: fileData,
    };
  }
}

