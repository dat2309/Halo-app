import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { FriendService } from "./friend.service";
import { FriendController } from "./friend.controller";
import { Friend, FriendSchema } from "./schemas/friend.schema";
import { UserModule } from "../user/user.module";

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Friend.name, schema: FriendSchema }]),
        UserModule,
    ],
    providers: [FriendService],
    controllers: [FriendController],
    exports: [FriendService],
})
export class FriendModule { }
