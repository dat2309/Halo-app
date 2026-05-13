import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { FinanceService } from "./finance.service";
import { FinanceController } from "./finance.controller";
import {
  FinanceTransaction,
  FinanceTransactionSchema,
} from "./schemas/finance.schema";
import { SocketModule } from "../socket/socket.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FinanceTransaction.name, schema: FinanceTransactionSchema },
    ]),
    SocketModule,
  ],
  providers: [FinanceService],
  controllers: [FinanceController],
  exports: [FinanceService],
})
export class FinanceModule { }
