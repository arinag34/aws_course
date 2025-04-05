import { util } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
    const id = util.autoId();
    const createdAt = util.time.nowISO8601();

    const item = {
        id,
        userId: ctx.args.userId,
        createdAt,
        payLoad: ctx.args.payLoad
    };

    ctx.stash.id = id;
    ctx.stash.createdAt = createdAt;

    return ddb.put({ key: { id }, item });
}

export function response(ctx) {
    if (ctx.error) {
        return util.error(ctx.error.message, ctx.error.type);
    }

    return {
        id: ctx.stash.id,
        userId: ctx.args.userId,
        createdAt: ctx.stash.createdAt,
        payLoad: ctx.args.payLoad 
    };
}

