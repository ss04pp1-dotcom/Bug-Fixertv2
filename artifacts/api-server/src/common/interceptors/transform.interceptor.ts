import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
  errors: null;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiSuccessResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T>> {
    const request = context.switchToHttp().getRequest<{ method: string }>();
    const method  = request.method?.toUpperCase() ?? 'GET';

    return next.handle().pipe(
      map((data) => ({
        success: true,
        message: this.defaultMessage(method),
        data,
        errors: null,
      })),
    );
  }

  private defaultMessage(method: string): string {
    switch (method) {
      case 'POST':   return 'Created successfully';
      case 'PUT':
      case 'PATCH':  return 'Updated successfully';
      case 'DELETE': return 'Deleted successfully';
      default:       return 'Request successful';
    }
  }
}
