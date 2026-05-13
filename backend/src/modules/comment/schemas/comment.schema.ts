import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type CommentDocument = Comment & Document;

@Schema({ timestamps: true })
export class Comment {
  @Prop({ required: true, type: Types.ObjectId, ref: "Post" })
  postId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: "User" })
  userId: Types.ObjectId;

  @Prop({ required: true })
  content: string;

  @Prop({ type: Types.ObjectId, ref: "Comment", default: null })
  parentId: Types.ObjectId;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);

