import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  CalendarEvent,
  CalendarEventDocument,
} from "./schemas/calendar.schema";

@Injectable()
export class CalendarService {
  constructor(
    @InjectModel(CalendarEvent.name)
    private calendarEventModel: Model<CalendarEventDocument>
  ) { }

  async create(
    userId: string,
    createData: Partial<CalendarEvent>
  ): Promise<CalendarEventDocument> {
    const event = new this.calendarEventModel({
      userId: new Types.ObjectId(userId),
      ...createData,
    });
    return event.save();
  }

  async findAll(
    userId: string,
    date: string
  ): Promise<{
    list: CalendarEventDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const startOfDay = new Date(date);
    const endOfDay = new Date(date);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const query = {
      userId: new Types.ObjectId(userId),
      startDate: { $lt: endOfDay.toISOString() },
      endDate: { $gt: startOfDay.toISOString() },
    };

    const total = await this.calendarEventModel.countDocuments(query);
    const data = await this.calendarEventModel
      .find(query)
      .sort({ startDate: 1 })
      .exec();

    return {
      list: data,
      total,
      page: 1,
      limit: total,
      totalPages: 1,
    };
  }

  async getMonthlySummary(
    userId: string,
    month: number,
    year: number
  ): Promise<
    Pick<CalendarEventDocument, '_id' | 'startDate' | 'endDate' | 'color' | 'title'>[]
  > {
    const startOfMonth = new Date(year, month - 1, 1);
    startOfMonth.setDate(startOfMonth.getDate() - 1); // Pad start for timezone
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
    endOfMonth.setDate(endOfMonth.getDate() + 1); // Pad end for timezone

    const events = await this.calendarEventModel
      .find({
        userId: new Types.ObjectId(userId),
        startDate: { $lte: endOfMonth.toISOString() },
        endDate: { $gte: startOfMonth.toISOString() },
      })
      .select('startDate endDate color title')
      .lean();

    return events;
  }

  async getUpcoming(userId: string, limit: number = 5): Promise<CalendarEventDocument[]> {
    const now = new Date().toISOString();
    return this.calendarEventModel
      .find({
        userId: new Types.ObjectId(userId),
        endDate: { $gte: now },
      })
      .sort({ startDate: 1 })
      .limit(limit)
      .exec();
  }

  async findById(id: string): Promise<CalendarEventDocument | null> {
    return this.calendarEventModel.findById(id).exec();
  }

  async update(
    id: string,
    updateData: Partial<CalendarEvent>
  ): Promise<CalendarEventDocument> {
    return this.calendarEventModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.calendarEventModel.findOneAndDelete({ _id: id, userId: new Types.ObjectId(userId) }).exec();
  }
}

