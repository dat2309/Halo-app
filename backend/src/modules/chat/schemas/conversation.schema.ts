import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type ConversationDocument = Conversation & Document;

@Schema({ timestamps: true })
export class Conversation {
  // Always sorted ascending by ObjectId string — used to uniquely identify 1-1 pair
  @Prop({ type: [{ type: Types.ObjectId, ref: "User" }], required: true, index: true })
  participants: Types.ObjectId[];

  @Prop()
  lastMessage?: string;

  @Prop()
  lastMessageType?: "text" | "image" | "video";

  @Prop()
  lastMessageAt?: Date;

  @Prop({ type: Types.ObjectId, ref: "User" })
  lastMessageSenderId?: Types.ObjectId;

  // Map<userId, unreadCount>
  @Prop({ type: Object, default: {} })
  unreadCounts: Record<string, number>;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
ConversationSchema.index({ participants: 1, lastMessageAt: -1 });
