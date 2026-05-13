import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Reaction, ReactionDocument } from "./schemas/reaction.schema";
import { PostService } from "../post/post.service";

@Injectable()
export class ReactionService {
  constructor(
    @InjectModel(Reaction.name)
    private reactionModel: Model<ReactionDocument>,
    private postService: PostService
  ) { }

  async toggleReaction(
    postId: string,
    userId: string,
    type: string = "like"
  ): Promise<{ reaction: ReactionDocument | null; isNew: boolean }> {
    const existingReaction = await this.reactionModel.findOne({
      postId: new Types.ObjectId(postId),
      userId: new Types.ObjectId(userId),
    });

    if (existingReaction) {
      await this.reactionModel.findByIdAndDelete(existingReaction._id);
      await this.postService.decrementReactionCount(postId);
      return { reaction: null, isNew: false };
    } else {
      const reaction = new this.reactionModel({
        postId: new Types.ObjectId(postId),
        userId: new Types.ObjectId(userId),
        type,
      });
      await reaction.save();
      await this.postService.incrementReactionCount(postId);
      return { reaction, isNew: true };
    }
  }

  async findByPostId(
    postId: string,
    page: number,
    limit: number
  ): Promise<{
    list: ReactionDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.reactionModel
        .find({ postId: new Types.ObjectId(postId) })
        .populate("userId", "name email avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.reactionModel.countDocuments({ postId: new Types.ObjectId(postId) }).exec(),
    ]);

    return {
      list: data,
      total,
      page,
      limit,
    };
  }

  async findByUserId(userId: string): Promise<ReactionDocument[]> {
    return this.reactionModel.find({ userId: new Types.ObjectId(userId) }).exec();
  }

  async checkUserReaction(
    postId: string,
    userId: string
  ): Promise<ReactionDocument | null> {
    return this.reactionModel.findOne({ postId: new Types.ObjectId(postId), userId: new Types.ObjectId(userId) }).exec();
  }
}

