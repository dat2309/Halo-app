import { ApiProperty } from "@nestjs/swagger";

export class IceServerDto {
  @ApiProperty({
    description:
      "Single URL or array of URLs for this server (stun:/turn:/turns: protocol)",
    oneOf: [
      { type: "string" },
      { type: "array", items: { type: "string" } },
    ],
    example: "turn:openrelay.metered.ca:443?transport=tcp",
  })
  urls: string | string[];

  @ApiProperty({
    example: "openrelayproject",
    required: false,
    description: "Required for TURN servers, omitted for plain STUN",
  })
  username?: string;

  @ApiProperty({
    example: "openrelayproject",
    required: false,
    description: "TURN credential (may be short-lived in production)",
  })
  credential?: string;
}

export class IceServersResponseDataDto {
  @ApiProperty({
    isArray: true,
    type: IceServerDto,
    description:
      "WebRTC ICE servers in priority order. Pass directly to `new RTCPeerConnection({ iceServers })`.",
  })
  iceServers: IceServerDto[];
}
