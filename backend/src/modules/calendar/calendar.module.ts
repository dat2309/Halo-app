import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CalendarController } from "./calendar.controller";
import { CalendarService } from "./calendar.service";
import { CalendarEvent, CalendarEventSchema } from "./schemas/calendar.schema";
import { SocketModule } from "../socket/socket.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CalendarEvent.name, schema: CalendarEventSchema },
    ]),
    SocketModule,
  ],
  providers: [CalendarService],
  controllers: [CalendarController],
  exports: [CalendarService],
})
export class CalendarModule { }
