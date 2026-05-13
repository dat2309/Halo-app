import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type FinanceTransactionDocument = FinanceTransaction & Document;

@Schema({ timestamps: true })
export class FinanceTransaction {
  @Prop({ required: true, type: Types.ObjectId, ref: "User" })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: ["income", "expense"] })
  type: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  category: string;

  @Prop()
  note?: string;

  @Prop({ required: true })
  date: Date;

  @Prop()
  receiptImageUrl?: string;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const FinanceTransactionSchema =
  SchemaFactory.createForClass(FinanceTransaction);

FinanceTransactionSchema.index({ userId: 1, date: -1 });

