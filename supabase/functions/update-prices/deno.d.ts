// Local type stubs for the Deno runtime globals.
// The real types come from the edge-runtime at deploy time;
// this file exists only to satisfy the local VS Code TS server.
declare namespace Deno {
  function serve(handler: (req: Request) => Response | Promise<Response>): void
  const env: { get(key: string): string | undefined }
}
