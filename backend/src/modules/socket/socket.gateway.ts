import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { CommentService } from "../comment/comment.service";
import { PostService } from "../post/post.service";
import { ReactionService } from "../reaction/reaction.service";
import { ChatService } from "../chat/chat.service";
import { CallService } from "../call/call.service";

export const userRoom = (userId: string) => `user:${userId}`;

@WebSocketGateway({
  cors: {
    origin: "*",
  },
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SocketGateway.name);

  constructor(
    private jwtService: JwtService,
    private postService: PostService,
    private commentService: CommentService,
    private reactionService: ReactionService,
    private chatService: ChatService,
    private callService: CallService
  ) { }

  /* ------------------------------ Helpers ------------------------------ */

  emitToUser(userId: string, event: string, data: any) {
    if (!userId) return;
    this.server.to(userRoom(userId)).emit(event, data);
  }

  emitToUsers(userIds: string[], event: string, data: any) {
    const rooms = Array.from(new Set(userIds.filter(Boolean))).map(userRoom);
    if (rooms.length === 0) return;
    this.server.to(rooms).emit(event, data);
  }

  isUserOnline(userId: string): boolean {
    const room = this.server.sockets.adapter.rooms.get(userRoom(userId));
    return !!room && room.size > 0;
  }

  /**
   * After a call ends, push the system-style summary message to participants
   * so their chat thread updates without a manual refetch.
   */
  private emitCallSummary(
    summary: {
      message: any;
      conversation: any;
      participantIds: string[];
    } | null
  ) {
    if (!summary) return;
    this.emitToUsers(summary.participantIds, "chat:message", summary.message);
    this.emitToUsers(
      summary.participantIds,
      "chat:conversation_updated",
      summary.conversation
    );
  }

  /* --------------------------- Connection ----------------------------- */

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.replace("Bearer ", "");
      if (!token) {
        this.logger.warn(`Anonymous client rejected: ${client.id}`);
        client.disconnect();
        return;
      }
      const payload = this.jwtService.verify(token);
      const userId = payload.sub as string;
      client.data.userId = userId;
      client.join(userRoom(userId));
      this.logger.log(`User ${userId} connected (socket ${client.id})`);
    } catch (error: any) {
      this.logger.warn(
        `Connection error for client ${client.id}: ${error?.message}`
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId as string | undefined;
    if (userId) {
      this.logger.log(`User ${userId} disconnected (socket ${client.id})`);
      // If user has no more sockets, abort any active calls they own
      if (!this.isUserOnline(userId)) {
        this.callService.abortActiveCallsForUser(userId).then((results) => {
          results.forEach(({ session, summary }) => {
            const peer =
              session.callerId.toString() === userId
                ? session.calleeId.toString()
                : session.callerId.toString();
            this.emitToUser(peer, "call:ended", {
              callSessionId: session._id.toString(),
              reason: "peer_disconnected",
            });
            this.emitCallSummary(summary);
          });
        });
      }
    }
  }

  /* ------------------------------ Post -------------------------------- */

  @SubscribeMessage("post:create")
  async handlePostCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any
  ) {
    const post = await this.postService.findById(data.postId);
    if (post) {
      // Broadcast feed event — viewers will refetch their feed
      this.server.emit("post:new", post);
    }
  }

  /* ----------------------------- Comment ------------------------------ */

  emitCommentUpdated(
    postId: string,
    data: { action: string; commentCount: number }
  ) {
    // Broadcast: any user with this post in their feed needs the new count
    this.server.emit("comment:updated", { postId, ...data });
  }

  /* ---------------------------- Reaction ------------------------------ */

  emitReactionUpdated(
    postId: string,
    data: { action: string; reaction: any; reactionCount: number }
  ) {
    this.server.emit("reaction:updated", { postId, ...data });
  }

  /* ----------------------------- Finance (private) -------------------- */

  emitFinanceCreated(userId: string, transaction: any) {
    this.emitToUser(userId, "finance:created", transaction);
  }

  emitFinanceUpdated(userId: string, transaction: any) {
    this.emitToUser(userId, "finance:updated", transaction);
  }

  emitFinanceDeleted(userId: string, transactionId: string) {
    this.emitToUser(userId, "finance:deleted", { transactionId });
  }

  /* ---------------------------- Calendar (private) -------------------- */

  emitCalendarCreated(userId: string, event: any) {
    this.emitToUser(userId, "calendar:created", event);
  }

  emitCalendarUpdated(userId: string, event: any) {
    this.emitToUser(userId, "calendar:updated", event);
  }

  emitCalendarDeleted(userId: string, eventId: string) {
    this.emitToUser(userId, "calendar:deleted", { eventId });
  }

  /* -------------------------------- Chat ------------------------------ */

  @SubscribeMessage("chat:send")
  async handleChatSend(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      conversationId: string;
      type?: "text" | "image" | "video";
      content?: string;
      mediaUrl?: string;
    }
  ) {
    const userId = client.data.userId as string;
    if (!userId || !data?.conversationId) return;
    try {
      const result = await this.chatService.sendMessage({
        conversationId: data.conversationId,
        senderId: userId,
        type: data.type ?? "text",
        content: data.content,
        mediaUrl: data.mediaUrl,
      });
      this.emitToUsers(
        result.participantIds,
        "chat:message",
        result.message
      );
      this.emitToUsers(
        result.participantIds,
        "chat:conversation_updated",
        result.conversation
      );
    } catch (err: any) {
      client.emit("chat:error", { message: err?.message ?? "send failed" });
    }
  }

  @SubscribeMessage("chat:typing")
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; isTyping: boolean }
  ) {
    const userId = client.data.userId as string;
    if (!userId || !data?.conversationId) return;
    const peerIds = await this.chatService.getOtherParticipants(
      data.conversationId,
      userId
    );
    this.emitToUsers(peerIds, "chat:typing", {
      conversationId: data.conversationId,
      userId,
      isTyping: !!data.isTyping,
    });
  }

  @SubscribeMessage("chat:read")
  async handleRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; messageId?: string }
  ) {
    const userId = client.data.userId as string;
    if (!userId || !data?.conversationId) return;
    await this.chatService.markRead(data.conversationId, userId);
    const peerIds = await this.chatService.getOtherParticipants(
      data.conversationId,
      userId
    );
    this.emitToUsers(peerIds, "chat:read", {
      conversationId: data.conversationId,
      readerId: userId,
      messageId: data.messageId,
    });
  }

  /* -------------------------- Call signaling -------------------------- */

  @SubscribeMessage("call:invite")
  async handleCallInvite(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      calleeId: string;
      offerSdp: string;
      mode?: "audio" | "video";
    }
  ) {
    const callerId = client.data.userId as string;
    if (!callerId || !data?.calleeId) return;

    if (!this.isUserOnline(data.calleeId)) {
      client.emit("call:offline", { calleeId: data.calleeId });
      return;
    }
    if (await this.callService.isUserBusy(data.calleeId)) {
      client.emit("call:busy", { calleeId: data.calleeId });
      return;
    }

    const mode = data.mode === "audio" ? "audio" : "video";
    const session = await this.callService.createSession(
      callerId,
      data.calleeId,
      mode
    );
    const callSessionId = session._id.toString();

    this.emitToUser(data.calleeId, "call:incoming", {
      callSessionId,
      callerId,
      offerSdp: data.offerSdp,
      mode,
    });
    client.emit("call:ringing", { callSessionId, calleeId: data.calleeId, mode });
  }

  @SubscribeMessage("call:accept")
  async handleCallAccept(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callSessionId: string; answerSdp: string }
  ) {
    const userId = client.data.userId as string;
    const session = await this.callService.findActive(data.callSessionId);
    if (!session) return;
    if (session.calleeId.toString() !== userId) return;

    await this.callService.markAccepted(data.callSessionId);
    this.emitToUser(session.callerId.toString(), "call:accepted", {
      callSessionId: data.callSessionId,
      answerSdp: data.answerSdp,
    });
  }

  @SubscribeMessage("call:decline")
  async handleCallDecline(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callSessionId: string }
  ) {
    const userId = client.data.userId as string;
    const session = await this.callService.findActive(data.callSessionId);
    if (!session) return;
    if (session.calleeId.toString() !== userId) return;

    const { summary } = await this.callService.markEnded(
      data.callSessionId,
      "declined"
    );
    this.emitToUser(session.callerId.toString(), "call:declined", {
      callSessionId: data.callSessionId,
    });
    this.emitCallSummary(summary);
  }

  @SubscribeMessage("call:end")
  async handleCallEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callSessionId: string }
  ) {
    const userId = client.data.userId as string;
    const session = await this.callService.findActive(data.callSessionId);
    if (!session) return;
    const callerId = session.callerId.toString();
    const calleeId = session.calleeId.toString();
    if (userId !== callerId && userId !== calleeId) return;

    const { summary } = await this.callService.markEnded(
      data.callSessionId,
      "ended"
    );
    const peerId = userId === callerId ? calleeId : callerId;
    this.emitToUser(peerId, "call:ended", {
      callSessionId: data.callSessionId,
      reason: "ended",
    });
    this.emitCallSummary(summary);
  }

  @SubscribeMessage("call:ice")
  async handleCallIce(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callSessionId: string; candidate: any }
  ) {
    const userId = client.data.userId as string;
    const session = await this.callService.findActive(data.callSessionId);
    if (!session) return;
    const callerId = session.callerId.toString();
    const calleeId = session.calleeId.toString();
    if (userId !== callerId && userId !== calleeId) return;

    const peerId = userId === callerId ? calleeId : callerId;
    this.emitToUser(peerId, "call:ice", {
      callSessionId: data.callSessionId,
      candidate: data.candidate,
    });
  }

  /**
   * Caller signals the callee that their local audio/video tracks were
   * muted or camera turned off (and vice versa). Pure UI metadata —
   * actual media flow is controlled by track.enabled on each peer.
   */
  @SubscribeMessage("call:track_state")
  async handleCallTrackState(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      callSessionId: string;
      muted?: boolean;
      cameraOff?: boolean;
      isSharingScreen?: boolean;
    }
  ) {
    const userId = client.data.userId as string;
    const session = await this.callService.findActive(data.callSessionId);
    if (!session) return;
    const callerId = session.callerId.toString();
    const calleeId = session.calleeId.toString();
    if (userId !== callerId && userId !== calleeId) return;

    const peerId = userId === callerId ? calleeId : callerId;
    this.emitToUser(peerId, "call:track_state", {
      callSessionId: data.callSessionId,
      muted: !!data.muted,
      cameraOff: !!data.cameraOff,
      isSharingScreen: !!data.isSharingScreen,
    });
  }

  /**
   * Used for ICE restart when the connection drops mid-call. The peer sends a
   * fresh offer; we forward to the other side which answers and returns it.
   */
  @SubscribeMessage("call:restart_offer")
  async handleCallRestartOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callSessionId: string; offerSdp: string }
  ) {
    const userId = client.data.userId as string;
    const session = await this.callService.findActive(data.callSessionId);
    if (!session) return;
    const callerId = session.callerId.toString();
    const calleeId = session.calleeId.toString();
    if (userId !== callerId && userId !== calleeId) return;

    const peerId = userId === callerId ? calleeId : callerId;
    this.emitToUser(peerId, "call:restart_offer", {
      callSessionId: data.callSessionId,
      offerSdp: data.offerSdp,
    });
  }

  @SubscribeMessage("call:restart_answer")
  async handleCallRestartAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callSessionId: string; answerSdp: string }
  ) {
    const userId = client.data.userId as string;
    const session = await this.callService.findActive(data.callSessionId);
    if (!session) return;
    const callerId = session.callerId.toString();
    const calleeId = session.calleeId.toString();
    if (userId !== callerId && userId !== calleeId) return;

    const peerId = userId === callerId ? calleeId : callerId;
    this.emitToUser(peerId, "call:restart_answer", {
      callSessionId: data.callSessionId,
      answerSdp: data.answerSdp,
    });
  }
}
