import { util } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
    const item = {
        id: util.autoId(),
        userId: ctx.args.userId,
        createdAt: util.time.nowISO8601(),
        payLoad: JSON.parse(ctx.args.payLoad)
    };

    return ddb.put({ key: { id: item.id }, item });
}

export function response(ctx) {
    return ctx.result;
}