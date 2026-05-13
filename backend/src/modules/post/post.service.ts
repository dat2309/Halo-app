import { Inject, Injectable, forwardRef, NotFoundException, ForbiddenException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Post, PostDocument } from "./schemas/post.schema";
import { FriendService } from "../friend/friend.service";

@Injectable()
export class PostService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @Inject(forwardRef(() => FriendService))
    private friendService: FriendService
  ) { }

  async create(
    userId: string,
    type: string,
    mediaUrl: string,
    thumbnailUrl?: string,
    caption?: string,
    visibility?: string
  ): Promise<PostDocument> {
    const post = new this.postModel({
      userId: new Types.ObjectId(userId),
      type,
      mediaUrl,
      thumbnailUrl,
      caption,
      visibility: visibility ?? 'public',
    });
    return post.save();
  }

  async findAll(
    userId: string,
    page: number,
    limit: number
  ): Promise<{
    list: PostDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;

    // Get active friends to filter feed
    const friends = await this.friendService.getFriends(userId);
    const friendIds = friends.map((f: any) => f._id);
    const allowedUserIds = [new Types.ObjectId(userId), ...friendIds];

    // Show own posts (public + private) + friends' non-private posts
    const feedFilter = {
      $or: [
        { userId: new Types.ObjectId(userId) },
        { userId: { $in: friendIds }, visibility: { $ne: 'private' } },
      ],
    };

    const [data, total] = await Promise.all([
      this.postModel
        .find(feedFilter)
        .populate("userId", "name email avatar")
        .populate("reactions")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.postModel.countDocuments(feedFilter).exec(),
    ]);

    return {
      list: data,
      total,
      page,
      limit,
    };
  }

  async findById(id: string): Promise<PostDocument | null> {
    return this.postModel.findById(id).populate("userId", "name email avatar").populate("reactions").exec();
  }

  async discover(
    query: string | undefined,
    page: number,
    limit: number
  ): Promise<{ list: PostDocument[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const filter: any = { visibility: { $ne: 'private' } };
    if (query && query.trim()) {
      filter.caption = { $regex: query.trim(), $options: "i" };
    }
    const [data, total] = await Promise.all([
      this.postModel
        .find(filter)
        .populate("userId", "name email avatar username")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.postModel.countDocuments(filter).exec(),
    ]);
    return { list: data, total, page, limit };
  }

  async findByUserIdPaginated(
    userId: string,
    page: number,
    limit: number,
    requestingUserId?: string
  ): Promise<{ list: PostDocument[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const filter: any = { userId: new Types.ObjectId(userId) };
    // Hide private posts when viewing another user's profile
    if (requestingUserId && requestingUserId !== userId) {
      filter.visibility = { $ne: 'private' };
    }
    const [data, total] = await Promise.all([
      this.postModel
        .find(filter)
        .populate("userId", "name email avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.postModel.countDocuments(filter).exec(),
    ]);
    return { list: data, total, page, limit };
  }

  async countByUserId(userId: string): Promise<number> {
    return this.postModel.countDocuments({ userId: new Types.ObjectId(userId) }).exec();
  }

  async findByUserId(userId: string): Promise<PostDocument[]> {
    return this.postModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate("userId", "name email avatar")
      .populate("reactions")
      .sort({ createdAt: -1 })
      .exec();
  }

  async update(id: string, updateData: Partial<Post>): Promise<PostDocument> {
    return this.postModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  async delete(id: string, userId: string): Promise<void> {
    const post = await this.postModel.findById(id).exec();
    if (!post) {
      throw new NotFoundException("Post not found");
    }
    if (post.userId.toString() !== userId) {
      throw new ForbiddenException("You can only delete your own posts");
    }
    await this.postModel.findByIdAndDelete(id).exec();
  }

  async incrementCommentCount(id: string): Promise<number> {
    const post = await this.postModel
      .findByIdAndUpdate(id, { $inc: { commentCount: 1 } }, { new: true })
      .exec();
    return post?.commentCount ?? 0;
  }

  async decrementCommentCount(id: string, count: number = 1): Promise<number> {
    const post = await this.postModel
      .findByIdAndUpdate(id, { $inc: { commentCount: -count } }, { new: true })
      .exec();
    // Ensure count never goes below 0
    if (post && post.commentCount < 0) {
      post.commentCount = 0;
      await post.save();
    }
    return post?.commentCount ?? 0;
  }

  async incrementReactionCount(id: string): Promise<void> {
    await this.postModel.findByIdAndUpdate(id, { $inc: { reactionCount: 1 } }).exec();
  }

  async decrementReactionCount(id: string): Promise<void> {
    await this.postModel.findByIdAndUpdate(id, { $inc: { reactionCount: -1 } }).exec();
  }
}

