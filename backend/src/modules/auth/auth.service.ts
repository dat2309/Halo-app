import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { User } from "../user/schemas/user.schema";
import { UserService } from "../user/user.service";

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService
  ) { }

  async validateUser(identifier: string, password: string): Promise<any> {
    const user = await this.userService.findByEmailOrPhone(identifier);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await this.userService.validatePassword(
      password,
      user.password
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const { password: _, ...result } = user.toObject();
    return result;
  }
  async login(user: any) {
    const payload = { email: user.email, phone: user.phone, sub: user._id.toString() };
    return {
      accessToken: this.jwtService.sign(payload, { expiresIn: "1h" }),
      refreshToken: this.jwtService.sign(payload, { expiresIn: "7d" }),
      user: {
        _id: user._id.toString(),
        email: user.email,
        phone: user.phone,
        name: user.name,
        avatar: user.avatar,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  async register(
    email: string,
    password: string,
    name: string,
    phone: string,
    username: string
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Partial<User>;
  }> {
    const existingUser = await this.userService.findByEmail(email);
    if (existingUser) {
      throw new UnauthorizedException("Email already exists");
    }

    const existingPhone = await this.userService.findByPhone(phone);
    if (existingPhone) {
      throw new UnauthorizedException("Phone number already exists");
    }

    const existingUsername = await this.userService.findByUsername(username);
    if (existingUsername) {
      throw new UnauthorizedException("Username already exists");
    }

    const user = await this.userService.create(email, password, name, phone, username);
    const userObject = user.toObject();
    const { password: _, ...userData } = userObject;

    const payload = { email: user.email, phone: user.phone, sub: user._id.toString() };
    return {
      accessToken: this.jwtService.sign(payload, { expiresIn: "1h" }),
      refreshToken: this.jwtService.sign(payload, { expiresIn: "7d" }),
      user: userData,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const newPayload = { email: payload.email, phone: payload.phone, sub: payload.sub };
      return {
        accessToken: this.jwtService.sign(newPayload, { expiresIn: "1h" }),
      };
    } catch (error) {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }
}
