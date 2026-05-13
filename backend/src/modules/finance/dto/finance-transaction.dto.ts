import { ApiProperty } from "@nestjs/swagger";

export class FinanceTransactionDto {
  @ApiProperty({ example: "60d0fe4f5311236168a109ce" })
  _id: string;

  @ApiProperty({ example: "60d0fe4f5311236168a109ca" })
  userId: string;

  @ApiProperty({ enum: ["income", "expense"], example: "expense" })
  type: string;

  @ApiProperty({ example: 100.5 })
  amount: number;

  @ApiProperty({ example: "Food" })
  category: string;

  @ApiProperty({ example: "Lunch with team", required: false })
  note?: string;

  @ApiProperty({ example: "2024-12-15T00:00:00.000Z" })
  date: Date;

  @ApiProperty({ example: "https://example.com/receipt.jpg", required: false })
  receiptImageUrl?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
