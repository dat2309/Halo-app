import { IsString, IsDate, IsOptional, IsBoolean } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

export class CreateCalendarEventDto {
  @ApiProperty({ example: "Team Meeting", description: "Event title" })
  @IsString()
  title: string;

  @ApiProperty({ example: "Discuss project progress", description: "Event description (optional)", required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: "2024-12-15T10:00:00Z", description: "Event start date" })
  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @ApiProperty({ example: "2024-12-15T11:00:00Z", description: "Event end date" })
  @IsDate()
  @Type(() => Date)
  endDate: Date;

  @ApiProperty({ example: "#FF5733", description: "Event color (optional)", required: false })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ example: true, description: "Enable reminder (optional)", required: false })
  @IsOptional()
  @IsBoolean()
  reminder?: boolean;

  @ApiProperty({ example: "2024-12-15T09:45:00Z", description: "Reminder time (optional)", required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  reminderTime?: Date;
}

