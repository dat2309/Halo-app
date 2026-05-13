import { forwardRef, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { CommentModule } from "../comment/comment.module";
import { PostModule } from "../post/post.module";
import { ReactionModule } from "../reaction/reaction.module";
import { ChatModule } from "../chat/chat.module";
import { CallModule } from "../call/call.module";
import { SocketGateway } from "./socket.gateway";

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET") || "your-secret-key",
        signOptions: {
          expiresIn: configService.get<string>("JWT_EXPIRES_IN") || "1h",
        },
      }),

      inject: [ConfigService],
    }),
    forwardRef(() => PostModule),
    CommentModule,
    forwardRef(() => ReactionModule),
    ChatModule,
    CallModule,
  ],
  providers: [SocketGateway],
  exports: [SocketGateway],
})
export class SocketModule { }
