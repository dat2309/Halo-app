import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type CalendarEventDocument = CalendarEvent & Document;

@Schema({ timestamps: true })
export class CalendarEvent {
  @Prop({ required: true, type: Types.ObjectId, ref: "User" })
  userId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop()
  color?: string;

  @Prop({ default: false })
  reminder: boolean;

  @Prop()
  reminderTime?: Date;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const CalendarEventSchema = SchemaFactory.createForClass(CalendarEvent);

CalendarEventSchema.index({ userId: 1, startDate: 1, endDate: 1 });

