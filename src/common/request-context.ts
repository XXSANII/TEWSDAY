import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
  requestId: string;
  method: string;
  path: string;
  sessionId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();
export function setRequestSession(id: string) {
  const context = requestContext.getStore();
  if (context) context.sessionId = id;
}
