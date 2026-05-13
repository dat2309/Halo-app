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
import { CalendarService } from "./calendar.service";
import { CalendarEventDto } from "./dto/calendar-event.dto";
import { CreateCalendarEventDto } from "./dto/create-calendar-event.dto";
import { UpdateCalendarEventDto } from "./dto/update-calendar-event.dto";
import { SocketGateway } from "../socket/socket.gateway";

@ApiTags("Calendar")
@ApiBearerAuth("JWT-auth")
@Controller("calendar")
export class CalendarController {
  constructor(
    private calendarService: CalendarService,
    private socketGateway: SocketGateway
  ) { }

  @Post()
  @ApiOperation({ summary: "Create a new calendar event" })
  @ApiResponse({
    status: 201,
    description: "Event created successfully",
    type: SuccessResponseDto(CalendarEventDto),
  })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async create(@Request() req, @Body() createDto: CreateCalendarEventDto) {
    const event = await this.calendarService.create(req.user.userId, createDto);
    this.socketGateway.emitCalendarCreated(req.user.userId, event);
    return {
      success: true,
      data: event,
      message: "Event created successfully",
    };
  }

  @Get('summary')
  @ApiOperation({ summary: "Get monthly event summary" })
  @ApiQuery({ name: "month", required: true, type: Number })
  @ApiQuery({ name: "year", required: true, type: Number })
  @ApiResponse({
    status: 200,
    description: "Summary retrieved successfully",
  })
  async getSummary(
    @Request() req,
    @Query("month", ParseIntPipe) month: number,
    @Query("year", ParseIntPipe) year: number
  ) {
    const summary = await this.calendarService.getMonthlySummary(
      req.user.userId,
      month,
      year
    );
    return {
      success: true,
      data: summary,
    };
  }

  @Get('upcoming')
  @ApiOperation({ summary: "Get upcoming events" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Upcoming events" })
  async getUpcoming(
    @Request() req,
    @Query("limit", new DefaultValuePipe(5), ParseIntPipe) limit: number
  ) {
    const events = await this.calendarService.getUpcoming(req.user.userId, limit);
    return { success: true, data: events };
  }

  @Get()
  @ApiOperation({ summary: "Get all calendar events for the selected date" })
  @ApiQuery({ name: "date", required: true, type: String, example: "2023-10-27" })
  @ApiResponse({
    status: 200,
    description: "Events retrieved successfully",
    type: PaginatedResponseDto(CalendarEventDto),
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async findAll(
    @Request() req,
    @Query("date") date: string
  ) {
    // If date is missing, default to today? Or throw bad request? Service expects string.
    // Let's rely on client sending it, or ValidationPipe.
    if (!date) {
      // Fallback or error? User workflow implies selecting a date always.
      // Let's default to current ISO string if absolutely needed, but for now strict.
    }

    const result = await this.calendarService.findAll(
      req.user.userId,
      date || new Date().toISOString()
    );
    return {
      success: true,
      data: result,
    };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a specific calendar event by ID" })
  @ApiParam({ name: "id", description: "The ID of the calendar event" })
  @ApiResponse({
    status: 200,
    description: "Event retrieved successfully",
    type: SuccessResponseDto(CalendarEventDto),
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Event not found" })
  async findOne(@Request() req, @Param("id") id: string) {
    const event = await this.calendarService.findById(id);
    if (!event) {
      throw new NotFoundException("Event not found");
    }
    if (event.userId.toString() !== req.user.userId) {
      throw new ForbiddenException("You can only access your own events");
    }
    return {
      success: true,
      data: event,
    };
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a calendar event" })
  @ApiParam({ name: "id", description: "The ID of the calendar event" })
  @ApiResponse({
    status: 200,
    description: "Event updated successfully",
    type: SuccessResponseDto(CalendarEventDto),
  })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Event not found" })
  async update(
    @Request() req,
    @Param("id") id: string,
    @Body() updateDto: UpdateCalendarEventDto
  ) {
    const existingEvent = await this.calendarService.findById(id);
    if (!existingEvent) {
      throw new NotFoundException("Event not found");
    }
    if (existingEvent.userId.toString() !== req.user.userId) {
      throw new ForbiddenException("You can only update your own events");
    }

    const event = await this.calendarService.update(id, updateDto);
    this.socketGateway.emitCalendarUpdated(req.user.userId, event);
    return {
      success: true,
      data: event,
      message: "Event updated successfully",
    };
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a calendar event" })
  @ApiParam({ name: "id", description: "The ID of the calendar event" })
  @ApiResponse({
    status: 200,
    description: "Event deleted successfully",
    type: SuccessMessageDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Event not found" })
  async delete(@Request() req, @Param("id") id: string) {
    const event = await this.calendarService.findById(id);
    if (!event) {
      throw new NotFoundException("Event not found");
    }
    if (event.userId.toString() !== req.user.userId) {
      throw new ForbiddenException("You can only delete your own events");
    }
    await this.calendarService.delete(id, req.user.userId);
    this.socketGateway.emitCalendarDeleted(req.user.userId, id);
    return {
      success: true,
      message: "Event deleted successfully",
    };
  }
}
