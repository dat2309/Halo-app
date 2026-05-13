import { ApiProperty } from "@nestjs/swagger";
import { CallParticipantDto } from "./call-participant.dto";

export class CallSessionDto {
  @ApiProperty({ example: "65f0fe4f5311236168a109e0" })
  _id: string;

  @ApiProperty({
    type: CallParticipantDto,
    description: "Caller (populated user object in history responses)",
  })
  callerId: CallParticipantDto;

  @ApiProperty({
    type: CallParticipantDto,
    description: "Callee (populated user object in history responses)",
  })
  calleeId: CallParticipantDto;

  @ApiProperty({
    enum: ["ringing", "active", "ended", "declined", "missed", "aborted"],
    example: "ended",
    description:
      "Lifecycle: ringing → active (on accept) → ended/declined/aborted",
  })
  status: "ringing" | "active" | "ended" | "declined" | "missed" | "aborted";

  @ApiProperty({
    example: "2025-05-11T08:32:10.000Z",
    required: false,
    description: "Set when the callee accepts the call",
  })
  startedAt?: Date;

  @ApiProperty({
    example: "2025-05-11T08:35:42.000Z",
    required: false,
    description: "Set when the call terminates (any reason)",
  })
  endedAt?: Date;

  @ApiProperty({ example: "2025-05-11T08:32:00.000Z" })
  createdAt: Date;

  @ApiProperty({ example: "2025-05-11T08:35:42.000Z" })
  updatedAt: Date;
}
