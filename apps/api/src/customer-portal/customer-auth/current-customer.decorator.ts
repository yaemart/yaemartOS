import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

export const CurrentCustomer = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  if (request.customer) {
    return request.customer;
  }
  const cls: ClsService = request.cls;
  return cls?.get('customerId');
});
