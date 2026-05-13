import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  FinanceTransaction,
  FinanceTransactionDocument,
} from "./schemas/finance.schema";

@Injectable()
export class FinanceService {
  constructor(
    @InjectModel(FinanceTransaction.name)
    private financeTransactionModel: Model<FinanceTransactionDocument>
  ) { }

  async create(
    userId: string,
    createData: Partial<FinanceTransaction>
  ): Promise<FinanceTransactionDocument> {
    const transaction = new this.financeTransactionModel({
      userId: new Types.ObjectId(userId),
      ...createData,
    });
    return transaction.save();
  }

  async findAll(
    userId: string,
    page: number,
    limit: number,
    startDate?: string,
    endDate?: string
  ): Promise<{
    list: FinanceTransactionDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const filter: any = { userId: new Types.ObjectId(userId) };
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }


    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.financeTransactionModel
        .find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.financeTransactionModel.countDocuments(filter).exec(),
    ]);

    return {
      list: data,
      total,
      page,
      limit,
    };
  }

  async getYearlySummary(userId: string, year: number) {
    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const results = await this.financeTransactionModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { month: { $month: "$date" } },
          income: {
            $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] },
          },
          expense: {
            $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] },
          },
        },
      },
      { $sort: { "_id.month": 1 } },
    ]);

    // Khởi tạo 12 tháng
    const summary = Array.from({ length: 12 }, (_, i) => {
      const r = results.find((x) => x._id.month === i + 1);
      return {
        month: i + 1,
        income: r?.income ?? 0,
        expense: r?.expense ?? 0,
      };
    });

    return summary;
  }

  async getCalendarData(
    userId: string,
    year: number,
    month: number
  ): Promise<Record<string, FinanceTransactionDocument[]>> {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const transactions = await this.financeTransactionModel
      .find({
        userId: new Types.ObjectId(userId),
        date: { $gte: startDate, $lte: endDate },
      })
      .sort({ date: 1 })
      .exec();

    const grouped: Record<string, FinanceTransactionDocument[]> = {};
    for (const tx of transactions) {
      const dayKey = tx.date.toISOString().split('T')[0];
      if (!grouped[dayKey]) grouped[dayKey] = [];
      grouped[dayKey].push(tx);
    }

    return grouped;
  }

  async findById(id: string): Promise<FinanceTransactionDocument | null> {
    return this.financeTransactionModel.findById(id).exec();
  }

  async update(
    id: string,
    updateData: Partial<FinanceTransaction>
  ): Promise<FinanceTransactionDocument> {
    return this.financeTransactionModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.financeTransactionModel
      .findOneAndDelete({ _id: id, userId: new Types.ObjectId(userId) })
      .exec();
  }
}
