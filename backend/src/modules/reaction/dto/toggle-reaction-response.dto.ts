import { ApiProperty } from "@nestjs/swagger";
import { ReactionDto } from "./reaction.dto";

export class ToggleReactionResponseDto {
  @ApiProperty({
    description: "The action performed",
    enum: ["added", "removed"],
  })
  action: "added" | "removed";

  @ApiProperty({
    description: "The reaction object, null if removed",
    type: () => ReactionDto,
    nullable: true,
  })
  reaction: ReactionDto | null;
}
