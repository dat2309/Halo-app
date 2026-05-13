import { HttpStatus } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

interface IBaseResponse {
    status?: HttpStatus;
    message?: string;
    data?: unknown;
}

export class BaseResponse {
    @ApiProperty({
        type: Number,
        example: HttpStatus.OK,
    })
    status: HttpStatus;

    @ApiProperty({
        type: String,
        example: 'OK',
    })
    message: string;

    data: any;

    constructor(init?: IBaseResponse) {
        this.status = init?.status || HttpStatus.OK;
        this.message = init?.message || 'OK';
        this.data = init?.data || null;
    }
}

export class BaseResponseDataNull extends BaseResponse {
    @ApiProperty({
        type: Number,
        example: null,
    })
    data: unknown;
}

export class StatusCountResponse {
    @ApiProperty({
        type: Number,
        example: 3,
        description: 'Number of active records',
    })
    active: number;

    @ApiProperty({
        type: Number,
        example: 1,
        description: 'Number of inactive records',
    })
    inactive: number;

    @ApiProperty({
        type: Number,
        example: 4,
        description: 'Total number of records',
    })
    total: number;
}

export class StatusCountResponseSwagger extends BaseResponse {
    @ApiProperty({
        type: StatusCountResponse,
    })
    data: StatusCountResponse;
}

