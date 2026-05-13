import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { MongooseModule } from "@nestjs/mongoose";
import { AppController } from "./app.controller";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { HttpLoggerMiddleware } from "./common/middleware/http-logger.middleware";
import { AuthModule } from "./modules/auth/auth.module";
import { JwtAuthGuard } from "./modules/auth/guards/jwt-auth.guard";
import { CalendarModule } from "./modules/calendar/calendar.module";
import { CallModule } from "./modules/call/call.module";
import { ChatModule } from "./modules/chat/chat.module";
import { CommentModule } from "./modules/comment/comment.module";
import { FinanceModule } from "./modules/finance/finance.module";
import { FriendModule } from "./modules/friend/friend.module";
import { HealthModule } from "./modules/health/health.module";
import { PostModule } from "./modules/post/post.module";
import { ReactionModule } from "./modules/reaction/reaction.module";
import { SocketModule } from "./modules/socket/socket.module";
import { UploadModule } from "./modules/upload/upload.module";
import { UserModule } from "./modules/user/user.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRoot(
      process.env.MONGODB_URI || "mongodb://localhost:27017/halo"
    ),
    AuthModule,
    UserModule,
    PostModule,
    CommentModule,
    ReactionModule,
    CalendarModule,
    FinanceModule,
    UploadModule,
    ChatModule,
    CallModule,
    SocketModule,
    HealthModule,
    FriendModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggerMiddleware).forRoutes("*");
  }
}
