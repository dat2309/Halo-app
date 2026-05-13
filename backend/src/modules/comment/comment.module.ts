import { forwardRef, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CommentService } from "./comment.service";
import { CommentController } from "./comment.controller";
import { Comment, CommentSchema } from "./schemas/comment.schema";
import { PostModule } from "../post/post.module";
import { SocketModule } from "../socket/socket.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Comment.name, schema: CommentSchema }]),
    forwardRef(() => PostModule),
    forwardRef(() => SocketModule),
  ],
  providers: [CommentService],
  controllers: [CommentController],
  exports: [CommentService],
})
export class CommentModule { }

