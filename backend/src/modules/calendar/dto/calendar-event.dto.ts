import { ApiProperty } from "@nestjs/swagger";

export class CalendarEventDto {
  @ApiProperty({ example: "60d0fe4f5311236168a109cd" })
  _id: string;

  @ApiProperty({ example: "60d0fe4f5311236168a109ca" })
  userId: string;

  @ApiProperty({ example: "Team Meeting" })
  title: string;

  @ApiProperty({ example: "Discuss project progress", required: false })
  description?: string;

  @ApiProperty({ example: "2024-12-15T10:00:00Z" })
  startDate: Date;

  @ApiProperty({ example: "2024-12-15T11:00:00Z" })
  endDate: Date;

  @ApiProperty({ example: "#FF5733", required: false })
  color?: string;

  @ApiProperty({ example: true, required: false })
  reminder?: boolean;

  @ApiProperty({ example: "2024-12-15T09:45:00Z", required: false })
  reminderTime?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
