import { Prisma, PrismaClient } from '@prisma/client';
import { requestContext } from './common/request-context';
import { newId } from './common/ids';

export const db = new PrismaClient({ transactionOptions: { maxWait: 10000, timeout: 10000 } });
export type Transaction = Prisma.TransactionClient;

export async function transaction<T>(actor: string, fn: (tx: Transaction) => Promise<T>) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.actor_id', ${actor}, true)`;
    const result = await fn(tx);
    const context = requestContext.getStore();
    if (context?.sessionId) {
      await tx.user_activity_logs.create({
        data: {
          id: newId('ual'),
          user_id: actor,
          browser_session_id: context.sessionId,
          event_name: `${context.method} ${context.path}`.slice(0, 100),
          page_path: context.path.slice(0, 255),
          metadata: { request_id: context.requestId },
          created_by: actor,
          updated_by: actor,
        },
      });
    }
    return result;
  });
}
