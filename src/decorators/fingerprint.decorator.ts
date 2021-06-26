import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const DFingerprint = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const fingerprint = request.fingerprint;

    return data ? fingerprint?.[data] : fingerprint
  },
);