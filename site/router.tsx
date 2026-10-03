import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  // Every navigation opens at the top of the page, back included (DESIGN.md,
  // "Navigation scroll"). With restoration off the router scrolls to the top
  // after each render; the browser's own restoration is set to manual so it
  // cannot put the old position back on back.
  if (typeof window !== 'undefined') window.history.scrollRestoration = 'manual';

  return createRouter({
    routeTree,
    defaultPreload: 'intent',
    scrollRestoration: false,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
