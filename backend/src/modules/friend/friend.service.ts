import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Friend, FriendDocument } from "./schemas/friend.schema";
import { UserService } from "../user/user.service";

@Injectable()
export class FriendService {
    private readonly FRIEND_LIMIT = 50;

    constructor(
        @InjectModel(Friend.name) private friendModel: Model<FriendDocument>,
        private userService: UserService
    ) { }

    async sendRequest(requesterId: string, targetUsername: string): Promise<FriendDocument> {
        const recipient = await this.userService.findByUsername(targetUsername);
        if (!recipient) {
            throw new NotFoundException("User not found");
        }

        const recipientId = recipient._id.toString();

        if (requesterId === recipientId) {
            throw new BadRequestException("You cannot add yourself as a friend");
        }

        // Check if enough space (Limit friends)
        const friendCount = await this.friendModel.countDocuments({
            $or: [
                { requester: new Types.ObjectId(requesterId), status: "active" },
                { recipient: new Types.ObjectId(requesterId), status: "active" },
            ],
        });

        if (friendCount >= this.FRIEND_LIMIT) {
            throw new BadRequestException(`You have reached the limit of ${this.FRIEND_LIMIT} friends`);
        }

        // Check if relationship already exists
        const existing = await this.friendModel.findOne({
            $or: [
                { requester: new Types.ObjectId(requesterId), recipient: new Types.ObjectId(recipientId) },
                { requester: new Types.ObjectId(recipientId), recipient: new Types.ObjectId(requesterId) },
            ],
        });

        if (existing) {
            if (existing.status === "active") {
                throw new BadRequestException("You are already friends");
            }
            throw new BadRequestException("Friend request already sent or pending");
        }

        const newRequest = new this.friendModel({
            requester: new Types.ObjectId(requesterId),
            recipient: new Types.ObjectId(recipientId),
            status: "pending",
        });

        return newRequest.save();
    }

    async acceptRequest(requestId: string, userId: string): Promise<FriendDocument> {
        const friend = await this.friendModel.findOne({
            _id: requestId,
            recipient: new Types.ObjectId(userId),
            status: "pending",
        });

        if (!friend) {
            throw new NotFoundException("Friend request not found");
        }

        friend.status = "active";
        return friend.save();
    }

    async declineRequest(requestId: string, userId: string): Promise<void> {
        const result = await this.friendModel.deleteOne({
            _id: requestId,
            recipient: new Types.ObjectId(userId),
            status: "pending",
        });

        if (result.deletedCount === 0) {
            throw new NotFoundException("Friend request not found");
        }
    }

    async unfriend(userId: string, friendId: string): Promise<void> {
        const result = await this.friendModel.deleteOne({
            $or: [
                { requester: new Types.ObjectId(userId), recipient: new Types.ObjectId(friendId) },
                { requester: new Types.ObjectId(friendId), recipient: new Types.ObjectId(userId) },
            ],
            status: "active",
        });

        if (result.deletedCount === 0) {
            throw new NotFoundException("Friendship not found");
        }
    }

    async getFriends(userId: string) {
        const friends = await this.friendModel
            .find({
                $or: [
                    { requester: new Types.ObjectId(userId), status: "active" },
                    { recipient: new Types.ObjectId(userId), status: "active" },
                ],
            })
            .populate("requester", "name username avatar")
            .populate("recipient", "name username avatar")
            .exec();

        return friends.map((f) => {
            const isRequester = f.requester._id.toString() === userId;
            return isRequester ? f.recipient : f.requester;
        });
    }

    async getPendingRequests(userId: string) {
        return this.friendModel
            .find({
                recipient: new Types.ObjectId(userId),
                status: "pending",
            })
            .populate("requester", "name username avatar")
            .exec();
    }
}
