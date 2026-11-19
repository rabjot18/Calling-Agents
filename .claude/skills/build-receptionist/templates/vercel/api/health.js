// Unauthenticated liveness check used by deploy_vercel.py. It returns no client data.
export function GET() {
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
}
