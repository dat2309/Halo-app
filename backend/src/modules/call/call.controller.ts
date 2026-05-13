import {
  Controller,
  DefaultValuePipe,
  Get,
  Logger,
  ParseIntPipe,
  Query,
  Request,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { SuccessResponseDto } from "../../common/responses/api-response.dto";
import { CallService } from "./call.service";
import { CallParticipantDto } from "./dto/call-participant.dto";
import { CallSessionDto } from "./dto/call-session.dto";
import {
  IceServerDto,
  IceServersResponseDataDto,
} from "./dto/ice-server.dto";

type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

// OpenRelay by Metered — public free TURN, no signup required.
// Source: https://www.metered.ca/tools/openrelay/
// Note: rate-limited & shared; fine for sample/dev, not for production.
const OPENRELAY_ICE: IceServer[] = [
  { urls: "stun:openrelay.metered.ca:80" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

const STUN_ONLY_ICE: IceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

// Cache Metered API result briefly to avoid hammering on every call invite
let cachedMeteredServers: { servers: IceServer[]; expiresAt: number } | null =
  null;

@ApiTags("Call")
@ApiBearerAuth("JWT-auth")
@ApiExtraModels(CallParticipantDto, IceServerDto)
@Controller("call")
export class CallController {
  private readonly logger = new Logger(CallController.name);

  constructor(private callService: CallService) {}

  @Get("history")
  @ApiOperation({
    summary: "Recent call history of current user",
    description:
      "Returns calls where the user is either caller or callee, sorted by most recent first. Each session includes populated caller/callee user objects.",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Max number of sessions to return (default 30)",
  })
  @ApiResponse({
    status: 200,
    description: "Call history retrieved successfully",
    type: SuccessResponseDto(CallSessionDto),
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async history(
    @Request() req,
    @Query("limit", new DefaultValuePipe(30), ParseIntPipe) limit: number
  ) {
    const data = await this.callService.historyForUser(req.user.userId, limit);
    return { success: true, data };
  }

  @Get("ice-servers")
  @ApiOperation({
    summary: "Get ICE/TURN servers for WebRTC peer connection",
    description: `
Returns the list of ICE servers the client should pass to \`new RTCPeerConnection({ iceServers })\`.

**Provider priority** (chosen at request time):
1. **Metered managed** — if env \`METERED_API_KEY\` and \`METERED_SUBDOMAIN\` are set. Credentials are short-lived and fetched per-call (cached 1h server-side).
2. **OpenRelay** — public free TURN with static credentials. Default fallback. Suitable for dev/sample.
3. **STUN only** — if env \`DISABLE_TURN=true\`. Useful for testing same-network calls without relay overhead.

Clients should always re-fetch before each call rather than caching long-term, since managed credentials may rotate.
    `.trim(),
  })
  @ApiResponse({
    status: 200,
    description: "ICE servers retrieved successfully",
    type: SuccessResponseDto(IceServersResponseDataDto),
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async iceServers() {
    const meteredApiKey = process.env.METERED_API_KEY;
    const meteredSubdomain = process.env.METERED_SUBDOMAIN; // e.g. "halo"
    const disableTurn = process.env.DISABLE_TURN === "true";

    if (disableTurn) {
      return { success: true, data: { iceServers: STUN_ONLY_ICE } };
    }

    // Mode 1: Metered managed (free 50GB/month) — short-lived credentials
    if (meteredApiKey && meteredSubdomain) {
      const servers = await this.fetchMeteredServers(
        meteredSubdomain,
        meteredApiKey
      );
      if (servers) {
        return { success: true, data: { iceServers: servers } };
      }
      // fall through to OpenRelay if Metered fetch failed
    }

    // Mode 2 (default): OpenRelay public free TURN
    return { success: true, data: { iceServers: OPENRELAY_ICE } };
  }

  private async fetchMeteredServers(
    subdomain: string,
    apiKey: string
  ): Promise<IceServer[] | null> {
    if (cachedMeteredServers && cachedMeteredServers.expiresAt > Date.now()) {
      return cachedMeteredServers.servers;
    }
    try {
      const url = `https://${subdomain}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) {
        this.logger.warn(`Metered API responded ${res.status}`);
        return null;
      }
      const servers = (await res.json()) as IceServer[];
      if (!Array.isArray(servers) || servers.length === 0) {
        return null;
      }
      // Cache for 1 hour (credentials TTL is typically much longer)
      cachedMeteredServers = {
        servers,
        expiresAt: Date.now() + 60 * 60 * 1000,
      };
      return servers;
    } catch (e: any) {
      this.logger.warn(`Metered fetch failed: ${e?.message}`);
      return null;
    }
  }
}
