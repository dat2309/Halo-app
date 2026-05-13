import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { User, UserDocument } from "./schemas/user.schema";
import * as bcrypt from "bcrypt";

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) { }

  async create(email: string, password: string, name: string, phone: string, username: string): Promise<UserDocument> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new this.userModel({
      email,
      phone,
      username,
      password: hashedPassword,
      name,
    });
    return user.save();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findByPhone(phone: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ phone }).exec();
  }

  async findByUsername(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username: username.toLowerCase() }).exec();
  }

  async findByEmailOrPhone(identifier: string): Promise<UserDocument | null> {
    // Check if identifier is email (contains @) or phone
    const isEmail = identifier.includes('@');
    if (isEmail) {
      return this.findByEmail(identifier);
    }
    return this.findByPhone(identifier);
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async update(id: string, updateData: Partial<User>): Promise<UserDocument> {
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    return this.userModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  async searchUsers(
    query: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ list: UserDocument[]; total: number; page: number; limit: number }> {
    // Escape regex special characters so user input like "(", "*", "+" etc.
    // doesn't break the regex engine or alter the intended literal match.
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    const filter = {
      $or: [{ name: regex }, { username: regex }],
    };
    const skip = (page - 1) * limit;
    const [list, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select("_id name username avatar bio")
        .skip(skip)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);
    return { list, total, page, limit };
  }

  async validatePassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }
}

