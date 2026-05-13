import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type FriendDocument = Friend & Document;

@Schema({ timestamps: true })
export class Friend {
    @Prop({ type: Types.ObjectId, ref: "User", required: true })
    requester: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: "User", required: true })
    recipient: Types.ObjectId;

    @Prop({
        type: String,
        enum: ["pending", "active"],
        default: "pending",
    })
    status: string;
}

export const FriendSchema = SchemaFactory.createForClass(Friend);

// Unique index to prevent duplicate requests/relationships
FriendSchema.index({ requester: 1, recipient: 1 }, { unique: true });
// Index for faster lookups
FriendSchema.index({ status: 1 });
