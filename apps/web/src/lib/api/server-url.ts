/**
 * Base URL for API calls made by the web server itself: server components,
 * the `server-only` session helpers, and `proxy.ts`.
 *
 * In the deployed container, API_INTERNAL_URL points at the API process
 * running beside the web server (http://127.0.0.1:4000, no `/api` prefix),
 * so server-side calls never leave the machine. In local dev it is unset and
 * NEXT_PUBLIC_API_URL (http://localhost:4000) is used, as before.
 *
 * Browser code keeps reading NEXT_PUBLIC_API_URL directly. The container
 * build sets it to the relative `/api`, so every deployed copy of the app
 * (production, pilot, previews) calls its own API instead of one baked-in
 * host.
 */
export const SERVER_API_URL = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL;
