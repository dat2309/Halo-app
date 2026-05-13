import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  PaginatedResponseDto,
  SuccessResponseDto,
} from "../../common/responses/api-response.dto";
import { SuccessMessageDto } from "../../common/responses/success-message.dto";
import { CreateFinanceTransactionDto } from "./dto/create-finance-transaction.dto";
import { FinanceTransactionDto } from "./dto/finance-transaction.dto";
import { UpdateFinanceTransactionDto } from "./dto/update-finance-transaction.dto";
import { FinanceService } from "./finance.service";
import { SocketGateway } from "../socket/socket.gateway";

@ApiTags("Finance")
@ApiBearerAuth("JWT-auth")
@Controller("finance")
export class FinanceController {
  constructor(
    private financeService: FinanceService,
    private socketGateway: SocketGateway
  ) { }

  @Post()
  @ApiOperation({ summary: "Create a new finance transaction" })
  @ApiResponse({
    status: 201,
    description: "Transaction created successfully",
    type: SuccessResponseDto(FinanceTransactionDto),
  })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async create(@Request() req, @Body() createDto: CreateFinanceTransactionDto) {
    const transaction = await this.financeService.create(
      req.user.userId,
      createDto
    );
    this.socketGateway.emitFinanceCreated(req.user.userId, transaction);
    return {
      success: true,
      data: transaction,
      message: "Transaction created successfully",
    };
  }

  @Get()
  @ApiOperation({ summary: "Get all finance transactions (paginated)" })
  @ApiQuery({ name: "page", required: false, type: Number, example: 1 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 10 })
  @ApiQuery({ name: "startDate", required: false, type: String })
  @ApiQuery({ name: "endDate", required: false, type: String })
  @ApiResponse({
    status: 200,
    description: "Transactions retrieved successfully",
    type: PaginatedResponseDto(FinanceTransactionDto),
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async findAll(
    @Request() req,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string
  ) {
    const result = await this.financeService.findAll(
      req.user.userId,
      page,
      limit,
      startDate,
      endDate
    );
    return {
      success: true,
      data: result,
    };
  }

  @Get("summary")
  @ApiOperation({ summary: "Get yearly finance summary" })
  @ApiQuery({ name: "year", required: false, type: Number, example: 2023 })
  @ApiResponse({
    status: 200,
    description: "Summary retrieved successfully",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getSummary(
    @Request() req,
    @Query("year", new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe)
    year: number
  ) {
    const data = await this.financeService.getYearlySummary(
      req.user.userId,
      year
    );
    return {
      success: true,
      data,
    };
  }

  @Get("calendar")
  @ApiOperation({ summary: "Get transactions grouped by day for calendar view" })
  @ApiQuery({ name: "year", required: true, type: Number })
  @ApiQuery({ name: "month", required: true, type: Number })
  @ApiResponse({ status: 200, description: "Calendar data retrieved successfully" })
  async getCalendarData(
    @Request() req,
    @Query("year", ParseIntPipe) year: number,
    @Query("month", ParseIntPipe) month: number
  ) {
    const data = await this.financeService.getCalendarData(req.user.userId, year, month);
    return { success: true, data };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a specific finance transaction by ID" })
  @ApiParam({ name: "id", description: "The ID of the transaction" })
  @ApiResponse({
    status: 200,
    description: "Transaction retrieved successfully",
    type: SuccessResponseDto(FinanceTransactionDto),
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Transaction not found" })
  async findOne(@Request() req, @Param("id") id: string) {
    const transaction = await this.financeService.findById(id);
    if (!transaction) {
      throw new NotFoundException("Transaction not found");
    }
    if (transaction.userId.toString() !== req.user.userId) {
      throw new ForbiddenException("You can only access your own transactions");
    }
    return {
      success: true,
      data: transaction,
    };
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a finance transaction" })
  @ApiParam({ name: "id", description: "The ID of the transaction" })
  @ApiResponse({
    status: 200,
    description: "Transaction updated successfully",
    type: SuccessResponseDto(FinanceTransactionDto),
  })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Transaction not found" })
  async update(
    @Request() req,
    @Param("id") id: string,
    @Body() updateDto: UpdateFinanceTransactionDto
  ) {
    const existingTransaction = await this.financeService.findById(id);
    if (!existingTransaction) {
      throw new NotFoundException("Transaction not found");
    }
    if (existingTransaction.userId.toString() !== req.user.userId) {
      throw new ForbiddenException("You can only update your own transactions");
    }

    const transaction = await this.financeService.update(id, updateDto);
    this.socketGateway.emitFinanceUpdated(req.user.userId, transaction);
    return {
      success: true,
      data: transaction,
      message: "Transaction updated successfully",
    };
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a finance transaction" })
  @ApiParam({ name: "id", description: "The ID of the transaction" })
  @ApiResponse({
    status: 200,
    description: "Transaction deleted successfully",
    type: SuccessMessageDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Transaction not found" })
  async delete(@Request() req, @Param("id") id: string) {
    const transaction = await this.financeService.findById(id);
    if (!transaction) {
      throw new NotFoundException("Transaction not found");
    }
    if (transaction.userId.toString() !== req.user.userId) {
      throw new ForbiddenException("You can only delete your own transactions");
    }
    await this.financeService.delete(id, req.user.userId);
    this.socketGateway.emitFinanceDeleted(req.user.userId, id);
    return {
      success: true,
      message: "Transaction deleted successfully",
    };
  }
}

