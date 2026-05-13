import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UserService } from "./user.service";
import { UserController } from "./user.controller";
import { LookupController } from "./lookup.controller";
import { User, UserSchema } from "./schemas/user.schema";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [UserService],
  controllers: [UserController, LookupController],
  exports: [UserService],
})
export class UserModule { }

