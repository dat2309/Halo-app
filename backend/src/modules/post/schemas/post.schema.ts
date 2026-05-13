import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type PostDocument = Post & Document;

@Schema({ timestamps: true })
export class Post {
  @Prop({ required: true, type: Types.ObjectId, ref: "User" })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: ["image", "video"] })
  type: string;

  @Prop({ required: true })
  mediaUrl: string;

  @Prop()
  thumbnailUrl?: string;

  @Prop()
  caption?: string;

  @Prop({ default: 0 })
  reactionCount: number;

  @Prop({ default: 0 })
  commentCount: number;

  @Prop({ default: 'public', enum: ['public', 'private'] })
  visibility: string;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const PostSchema = SchemaFactory.createForClass(Post);

PostSchema.virtual('reactions', {
  ref: 'Reaction',
  localField: '_id',
  foreignField: 'postId',
});

PostSchema.set('toJSON', { virtuals: true });
PostSchema.set('toObject', { virtuals: true });

PostSchema.index({ userId: 1, createdAt: -1 });

