import { IsEnum, IsNumber, IsString, IsOptional, IsDate } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

export class CreateFinanceTransactionDto {
  @ApiProperty({ enum: ["income", "expense"], example: "expense", description: "Transaction type" })
  @IsEnum(["income", "expense"])
  type: string;

  @ApiProperty({ example: 100.50, description: "Transaction amount" })
  @IsNumber()
  amount: number;

  @ApiProperty({ example: "Food", description: "Transaction category" })
  @IsString()
  category: string;

  @ApiProperty({ example: "Lunch with team", description: "Transaction note (optional)", required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ example: "2024-12-15", description: "Transaction date" })
  @IsDate()
  @Type(() => Date)
  date: Date;

  @ApiProperty({ example: "https://example.com/receipt.jpg", description: "Receipt image URL (optional)", required: false })
  @IsOptional()
  @IsString()
  receiptImageUrl?: string;
}

