import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  Conversation,
  ConversationDocument,
} from "./schemas/conversation.schema";
import { Message, MessageDocument } from "./schemas/message.schema";

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversation.name)
    private conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name)
    private messageModel: Model<MessageDocument>
  ) {}

  /** Sorted participants ensure idempotent lookup of a 1-1 pair. */
  private sortedPair(a: string, b: string): Types.ObjectId[] {
    const ids = [a, b].sort();
    return ids.map((id) => new Types.ObjectId(id));
  }

  async getOrCreateConversation(
    userId: string,
    peerId: string
  ): Promise<ConversationDocument> {
    if (userId === peerId) {
      throw new ForbiddenException("Cannot start a conversation with yourself");
    }
    const participants = this.sortedPair(userId, peerId);
    const existing = await this.conversationModel
      .findOne({ participants: { $all: participants, $size: 2 } })
      .populate("participants", "name avatar username")
      .exec();
    if (existing) return existing;
    const created = await this.conversationModel.create({
      participants,
      unreadCounts: {},
    });
    // Re-fetch so participants come back populated (create() returns raw ObjectIds)
    return (await this.conversationModel
      .findById(created._id)
      .populate("participants", "name avatar username")
      .exec()) as ConversationDocument;
  }

  async listConversations(userId: string) {
    const userObjId = new Types.ObjectId(userId);
    const list = await this.conversationModel
      .find({ participants: userObjId })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate("participants", "name avatar username")
      .lean()
      .exec();
    return list.map((c) => ({
      ...c,
      unreadCount: c.unreadCounts?.[userId] ?? 0,
    }));
  }

  async ensureMember(conversationId: string, userId: string) {
    const conv = await this.conversationModel.findById(conversationId).exec();
    if (!conv) throw new NotFoundException("Conversation not found");
    const member = conv.participants.some(
      (p) => p.toString() === userId
    );
    if (!member) throw new ForbiddenException("Not a member of this conversation");
    return conv;
  }

  async getMessages(
    conversationId: string,
    userId: string,
    cursor?: string,
    limit = 30
  ) {
    await this.ensureMember(conversationId, userId);
    const filter: any = {
      conversationId: new Types.ObjectId(conversationId),
    };
    if (cursor) {
      filter._id = { $lt: new Types.ObjectId(cursor) };
    }
    const items = await this.messageModel
      .find(filter)
      .sort({ _id: -1 })
      .limit(limit)
      .lean()
      .exec();
    const nextCursor =
      items.length === limit ? items[items.length - 1]._id.toString() : null;
    return { list: items, nextCursor, limit };
  }

  async getOtherParticipants(
    conversationId: string,
    userId: string
  ): Promise<string[]> {
    const conv = await this.conversationModel
      .findById(conversationId)
      .lean()
      .exec();
    if (!conv) return [];
    return conv.participants
      .map((p) => p.toString())
      .filter((id) => id !== userId);
  }

  async sendMessage(input: {
    conversationId: string;
    senderId: string;
    type: "text" | "image" | "video";
    content?: string;
    mediaUrl?: string;
  }) {
    if (!input.content && !input.mediaUrl) {
      throw new ForbiddenException("Empty message");
    }
    const conv = await this.ensureMember(input.conversationId, input.senderId);

    const message = await this.messageModel.create({
      conversationId: new Types.ObjectId(input.conversationId),
      senderId: new Types.ObjectId(input.senderId),
      type: input.type,
      content: input.content,
      mediaUrl: input.mediaUrl,
      readBy: [new Types.ObjectId(input.senderId)],
    });

    // Update unread counts for other participants
    const unread = { ...(conv.unreadCounts ?? {}) };
    for (const p of conv.participants) {
      const pid = p.toString();
      if (pid !== input.senderId) {
        unread[pid] = (unread[pid] ?? 0) + 1;
      }
    }

    const preview =
      input.type === "text" ? input.content : `[${input.type}]`;

    const updated = await this.conversationModel
      .findByIdAndUpdate(
        input.conversationId,
        {
          lastMessage: preview,
          lastMessageType: input.type,
          lastMessageSenderId: new Types.ObjectId(input.senderId),
          lastMessageAt: new Date(),
          unreadCounts: unread,
        },
        { new: true }
      )
      .populate("participants", "name avatar username")
      .lean()
      .exec();

    return {
      message: message.toObject(),
      conversation: updated,
      participantIds: conv.participants.map((p) => p.toString()),
    };
  }

  async markRead(conversationId: string, userId: string) {
    const conv = await this.ensureMember(conversationId, userId);
    const unread = { ...(conv.unreadCounts ?? {}) };
    if (unread[userId]) {
      delete unread[userId];
    }
    await this.conversationModel.updateOne(
      { _id: conv._id },
      { $set: { unreadCounts: unread } }
    );
    await this.messageModel.updateMany(
      {
        conversationId: conv._id,
        readBy: { $ne: new Types.ObjectId(userId) },
      },
      { $addToSet: { readBy: new Types.ObjectId(userId) } }
    );
    return { success: true };
  }
}
