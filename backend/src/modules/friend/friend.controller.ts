import {
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Query,
    Request,
    UseGuards,
} from "@nestjs/common";
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from "@nestjs/swagger";
import { FriendService } from "./friend.service";
import { SuccessResponseDto } from "../../common/responses/api-response.dto";
import { SuccessMessageDto } from "../../common/responses/success-message.dto";

@ApiTags("Friends")
@ApiBearerAuth("JWT-auth")
@Controller("friends")
export class FriendController {
    constructor(private friendService: FriendService) { }

    @Post("request")
    @ApiOperation({ summary: "Send a friend request by username" })
    @ApiResponse({ status: 201, description: "Request sent successfully" })
    async sendRequest(@Request() req, @Query("username") username: string) {
        const friend = await this.friendService.sendRequest(req.user.userId, username);
        return {
            success: true,
            data: friend,
            message: "Friend request sent successfully",
        };
    }

    @Get("pending")
    @ApiOperation({ summary: "Get pending friend requests" })
    @ApiResponse({ status: 200, description: "Pending requests retrieved" })
    async getPending(@Request() req) {
        const requests = await this.friendService.getPendingRequests(req.user.userId);
        return {
            success: true,
            data: requests,
        };
    }

    @Post(":id/accept")
    @ApiOperation({ summary: "Accept a friend request" })
    async acceptRequest(@Request() req, @Param("id") requestId: string) {
        const friend = await this.friendService.acceptRequest(requestId, req.user.userId);
        return {
            success: true,
            data: friend,
            message: "Friend request accepted",
        };
    }

    @Post(":id/decline")
    @ApiOperation({ summary: "Decline a friend request" })
    async declineRequest(@Request() req, @Param("id") requestId: string) {
        await this.friendService.declineRequest(requestId, req.user.userId);
        return {
            success: true,
            message: "Friend request declined",
        };
    }

    @Get()
    @ApiOperation({ summary: "Get active friends list" })
    async getFriends(@Request() req) {
        const friends = await this.friendService.getFriends(req.user.userId);
        return {
            success: true,
            data: friends,
        };
    }

    @Delete(":id")
    @ApiOperation({ summary: "Unfriend a user" })
    async unfriend(@Request() req, @Param("id") friendId: string) {
        await this.friendService.unfriend(req.user.userId, friendId);
        return {
            success: true,
            message: "Unfriended successfully",
        };
    }
}
