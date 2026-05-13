import {
    CallHandler,
    ExecutionContext,
    HttpStatus,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable, map } from 'rxjs';
import { BaseResponse } from '../responses/base.response';

@Injectable()
export class TransformInterceptor<T>
    implements NestInterceptor<T, BaseResponse>
{
    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<BaseResponse> {
        const response = context.switchToHttp().getResponse<Response>();
        response.status(HttpStatus.OK);

        return next.handle().pipe(
            map((data) => {
                // Nếu handler đã trả về BaseResponse thì giữ nguyên
                if (data instanceof BaseResponse) {
                    return data;
                }

                // Nếu handler trả về { success, data, message?, status? }
                if (
                    data &&
                    typeof data === 'object' &&
                    'data' in data &&
                    'success' in data
                ) {
                    return new BaseResponse({
                        status:
                            (data as any).status ?? HttpStatus.OK,
                        message:
                            (data as any).message ?? 'OK',
                        data: (data as any).data,
                    });
                }

                // Mặc định: wrap payload vào BaseResponse
                return new BaseResponse({ data });
            }),
        );
    }
}

