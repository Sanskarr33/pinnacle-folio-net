// Local type stubs for the Deno + Supabase Edge Function runtime.
// Real types come from the edge-runtime at deploy time; this file
// only exists to silence the VS Code Node-TS language server.

declare namespace Deno {
  function serve(handler: (req: Request) => Response | Promise<Response>): void
  const env: { get(key: string): string | undefined }
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  interface QueryBuilder {
    select(cols: string): QueryBuilder
    not(col: string, op: string, val: unknown): QueryBuilder
    in(col: string, vals: unknown[]): QueryBuilder
    eq(col: string, val: unknown): QueryBuilder
    order(col: string, opts: { ascending: boolean }): QueryBuilder
    limit(n: number): QueryBuilder
    single(): Promise<{ data: unknown; error: { message: string } | null }>
    then: Promise<{ data: unknown; error: { message: string } | null }>['then']
  }
  interface UpdateBuilder {
    eq(col: string, val: unknown): Promise<{ error: { message: string } | null }>
  }
  interface TableRef {
    select(cols: string): QueryBuilder
    update(vals: unknown): UpdateBuilder
  }
  interface SupabaseClient {
    from(table: string): TableRef
  }
  export function createClient(url: string, key: string): SupabaseClient
}
