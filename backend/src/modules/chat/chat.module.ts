import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import {
  Conversation,
  ConversationSchema,
} from "./schemas/conversation.schema";
import { Message, MessageSchema } from "./schemas/message.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
  ],
  providers: [ChatService],
  controllers: [ChatController],
  exports: [ChatService],
})
export class ChatModule {}
