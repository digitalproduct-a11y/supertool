// Vercel Edge Middleware: prevents the Cloudflare WAF from being bypassed by
// hitting the *.vercel.app origin directly. Cloudflare is configured with a
// Transform Rule that injects `x-cf-guard: <CF_GUARD_SECRET>` on every proxied
// request; requests to sensitive paths that arrive without it did not pass
// through the WAF and are rejected.
//
// FAILS OPEN when CF_GUARD_SECRET is unset, so this is inert until the
// Cloudflare side is set up — deploying it cannot lock anyone out early.

export const config = {
  matcher: ['/api/admin-auth', '/webhook/:path*'],
}

export default function middleware(request: Request): Response | undefined {
  const secret = process.env.CF_GUARD_SECRET
  if (!secret) return undefined // Cloudflare not wired up yet → allow.

  if (request.headers.get('x-cf-guard') === secret) return undefined

  return new Response(
    JSON.stringify({ error: 'Direct origin access is not allowed.' }),
    { status: 403, headers: { 'content-type': 'application/json' } },
  )
}
