import { forwardRef, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ReactionService } from "./reaction.service";
import { ReactionController } from "./reaction.controller";
import { Reaction, ReactionSchema } from "./schemas/reaction.schema";
import { PostModule } from "../post/post.module";
import { SocketModule } from "../socket/socket.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Reaction.name, schema: ReactionSchema },
    ]),
    forwardRef(() => PostModule),
    forwardRef(() => SocketModule),
  ],
  providers: [ReactionService],
  controllers: [ReactionController],
  exports: [ReactionService],
})
export class ReactionModule { }

