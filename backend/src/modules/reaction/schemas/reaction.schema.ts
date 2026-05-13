import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type ReactionDocument = Reaction & Document;

@Schema({ timestamps: true })
export class Reaction {
  @Prop({ required: true, type: Types.ObjectId, ref: "Post" })
  postId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: "User" })
  userId: Types.ObjectId;

  @Prop({
    required: true,
    enum: ["like", "love", "laugh", "wow", "sad", "angry"],
    default: "like",
  })
  type: string;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const ReactionSchema = SchemaFactory.createForClass(Reaction);
ReactionSchema.index({ postId: 1, userId: 1 }, { unique: true });

ReactionSchema.set('toJSON', { virtuals: true });
ReactionSchema.set('toObject', { virtuals: true });

