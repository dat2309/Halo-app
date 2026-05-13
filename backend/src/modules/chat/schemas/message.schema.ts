import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({ required: true, type: Types.ObjectId, ref: "Conversation", index: true })
  conversationId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: "User" })
  senderId: Types.ObjectId;

  @Prop({ required: true, enum: ["text", "image", "video"], default: "text" })
  type: "text" | "image" | "video";

  @Prop()
  content?: string;

  @Prop()
  mediaUrl?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: "User" }], default: [] })
  readBy: Types.ObjectId[];
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ conversationId: 1, createdAt: -1 });
