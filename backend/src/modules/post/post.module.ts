import { forwardRef, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { PostService } from "./post.service";
import { PostController } from "./post.controller";
import { Post, PostSchema } from "./schemas/post.schema";
import { ReactionModule } from "../reaction/reaction.module";
import { FriendModule } from "../friend/friend.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Post.name, schema: PostSchema }]),
    forwardRef(() => ReactionModule),
    forwardRef(() => FriendModule),
  ],
  providers: [PostService],
  controllers: [PostController],
  exports: [PostService],
})
export class PostModule { }

