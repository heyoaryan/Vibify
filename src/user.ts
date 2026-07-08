import { getCurrentUser } from './auth';

export const currentUser = new Proxy({} as Record<string, unknown>, {
  get: (_target, prop) => {
    const user = getCurrentUser();
    return (user as Record<string, unknown>)[prop as string];
  },
});
