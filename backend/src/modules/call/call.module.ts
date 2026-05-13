import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CallController } from "./call.controller";
import { CallService } from "./call.service";
import { ChatModule } from "../chat/chat.module";
import {
  CallSession,
  CallSessionSchema,
} from "./schemas/call-session.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CallSession.name, schema: CallSessionSchema },
    ]),
    ChatModule,
  ],
  providers: [CallService],
  controllers: [CallController],
  exports: [CallService],
})
export class CallModule {}
