import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  CallSession,
  CallSessionDocument,
  CallStatus,
} from "./schemas/call-session.schema";
import { ChatService } from "../chat/chat.service";

const ACTIVE_STATUSES: CallStatus[] = ["ringing", "active"];

@Injectable()
export class CallService {
  constructor(
    @InjectModel(CallSession.name)
    private callSessionModel: Model<CallSessionDocument>,
    private chatService: ChatService
  ) {}

  async isUserBusy(userId: string): Promise<boolean> {
    const userObj = new Types.ObjectId(userId);
    const count = await this.callSessionModel.countDocuments({
      status: { $in: ACTIVE_STATUSES },
      $or: [{ callerId: userObj }, { calleeId: userObj }],
    });
    return count > 0;
  }

  async createSession(
    callerId: string,
    calleeId: string,
    mode: "audio" | "video" = "video"
  ): Promise<CallSessionDocument> {
    return this.callSessionModel.create({
      callerId: new Types.ObjectId(callerId),
      calleeId: new Types.ObjectId(calleeId),
      status: "ringing",
      mode,
    });
  }

  async findActive(id: string): Promise<CallSessionDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.callSessionModel
      .findOne({ _id: id, status: { $in: ACTIVE_STATUSES } })
      .exec();
  }

  async findById(id: string): Promise<CallSessionDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.callSessionModel.findById(id).exec();
  }

  async markAccepted(id: string) {
    return this.callSessionModel
      .findByIdAndUpdate(
        id,
        { status: "active", startedAt: new Date() },
        { new: true }
      )
      .exec();
  }

  async markEnded(
    id: string,
    reason: "ended" | "declined" | "aborted" | "missed"
  ) {
    const session = await this.callSessionModel
      .findByIdAndUpdate(
        id,
        { status: reason, endedAt: new Date() },
        { new: true }
      )
      .exec();
    if (session) {
      // Insert a system-style message into the corresponding 1-1 conversation
      // so the chat thread shows the call in-context.
      await this.insertCallSummaryMessage(session, reason);
    }
    return session;
  }

  private async insertCallSummaryMessage(
    session: CallSessionDocument,
    reason: "ended" | "declined" | "aborted" | "missed"
  ) {
    try {
      const callerId = session.callerId.toString();
      const calleeId = session.calleeId.toString();
      const conv = await this.chatService.getOrCreateConversation(
        callerId,
        calleeId
      );
      const durationSec =
        session.startedAt && session.endedAt
          ? Math.max(
              0,
              Math.round(
                (session.endedAt.getTime() - session.startedAt.getTime()) / 1000
              )
            )
          : 0;
      const summary = JSON.stringify({
        kind: "call",
        mode: (session as any).mode ?? "video",
        reason,
        durationSec,
        callerId,
        calleeId,
      });
      await this.chatService.sendMessage({
        conversationId: conv._id.toString(),
        senderId: callerId,
        type: "text",
        content: `__call__${summary}`,
      });
    } catch {
      // Don't let chat insertion break call lifecycle
    }
  }

  async abortActiveCallsForUser(
    userId: string
  ): Promise<CallSessionDocument[]> {
    const userObj = new Types.ObjectId(userId);
    const active = await this.callSessionModel
      .find({
        status: { $in: ACTIVE_STATUSES },
        $or: [{ callerId: userObj }, { calleeId: userObj }],
      })
      .exec();
    if (active.length === 0) return [];
    await this.callSessionModel.updateMany(
      { _id: { $in: active.map((s) => s._id) } },
      { $set: { status: "aborted", endedAt: new Date() } }
    );
    // Insert summary for each aborted session
    for (const s of active) {
      await this.insertCallSummaryMessage(s, "aborted");
    }
    return active;
  }

  async historyForUser(userId: string, limit = 30) {
    const userObj = new Types.ObjectId(userId);
    return this.callSessionModel
      .find({ $or: [{ callerId: userObj }, { calleeId: userObj }] })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("callerId", "name avatar username")
      .populate("calleeId", "name avatar username")
      .lean()
      .exec();
  }
}
