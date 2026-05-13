import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type CallSessionDocument = CallSession & Document;

export const CALL_STATUSES = [
  "ringing",
  "active",
  "ended",
  "declined",
  "missed",
  "aborted",
] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

@Schema({ timestamps: true })
export class CallSession {
  @Prop({ required: true, type: Types.ObjectId, ref: "User", index: true })
  callerId: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: "User", index: true })
  calleeId: Types.ObjectId;

  @Prop({ required: true, enum: CALL_STATUSES, default: "ringing" })
  status: CallStatus;

  @Prop({ enum: ["audio", "video"], default: "video" })
  mode: "audio" | "video";

  @Prop()
  startedAt?: Date;

  @Prop()
  endedAt?: Date;
}

export const CallSessionSchema = SchemaFactory.createForClass(CallSession);
CallSessionSchema.index({ callerId: 1, status: 1 });
CallSessionSchema.index({ calleeId: 1, status: 1 });
