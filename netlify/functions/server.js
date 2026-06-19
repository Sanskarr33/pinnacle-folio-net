// Netlify Functions v2 adapter for TanStack Start.
// Netlify bundles this file with esbuild, which follows the import into
// dist/server/server.js and bundles the entire SSR graph into one file.
// The v2 format passes the original Request URL (not the function URL),
// so TanStack Router sees the correct path for route matching.

import server from '../../dist/server/server.js'

export default async (request, context) => {
  return server.fetch(request, {}, context)
}
