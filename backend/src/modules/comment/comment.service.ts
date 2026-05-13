import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Comment, CommentDocument } from "./schemas/comment.schema";
import { PostService } from "../post/post.service";

@Injectable()
export class CommentService {
  constructor(
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    private postService: PostService
  ) { }

  async create(
    postId: string,
    userId: string,
    content: string,
    parentId?: string
  ): Promise<{ comment: CommentDocument; commentCount: number }> {
    const comment = new this.commentModel({
      postId: new Types.ObjectId(postId),
      userId: new Types.ObjectId(userId),
      content,
      parentId: parentId ? new Types.ObjectId(parentId) : null,
    });
    const commentCount = await this.postService.incrementCommentCount(postId);
    const savedComment = await comment.save();
    return { comment: savedComment, commentCount };
  }

  async findByPostId(
    postId: string,
    page: number,
    limit: number
  ): Promise<{
    list: CommentDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.commentModel
        .find({ postId: new Types.ObjectId(postId) })
        .populate("userId", "name email avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.commentModel.countDocuments({ postId: new Types.ObjectId(postId) }).exec(),
    ]);

    return {
      list: data,
      total,
      page,
      limit,
    };
  }

  async findById(id: string): Promise<CommentDocument | null> {
    return this.commentModel.findById(id).populate("userId", "name email avatar").exec();
  }

  async update(id: string, content: string): Promise<CommentDocument> {
    return this.commentModel
      .findByIdAndUpdate(id, { content }, { new: true })
      .exec();
  }

  async delete(id: string, postId: string, userId: string): Promise<number> {
    const comment = await this.commentModel.findById(id).exec();
    if (!comment) {
      throw new NotFoundException("Comment not found");
    }
    if (comment.userId.toString() !== userId) {
      throw new ForbiddenException("You can only delete your own comments");
    }

    // Count replies before deleting
    const replyCount = await this.commentModel.countDocuments({ parentId: comment._id }).exec();

    // Delete the comment and its replies
    await this.commentModel.findByIdAndDelete(id).exec();
    await this.commentModel.deleteMany({ parentId: comment._id }).exec();

    // Decrement by total deleted (comment + replies)
    const totalDeleted = 1 + replyCount;
    return this.postService.decrementCommentCount(postId, totalDeleted);
  }
}

