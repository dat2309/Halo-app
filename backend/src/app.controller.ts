import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from './common/decorators/public.decorator';
import { BaseResponse } from './common/responses/base.response';

@ApiTags('PUBLIC')
@Controller('public')
@Public()
export class AppController {
  @Get('health-check')
  async healthCheck(@Res() res: Response) {
    const response: BaseResponse = new BaseResponse();
    response.data = {
      build_number: process.env.CONFIG_BUILD_NUMBER || '',
      build_time: process.env.CONFIG_BUILD_TIME || '',
    };

    return res.status(HttpStatus.OK).send(response);
  }
}

