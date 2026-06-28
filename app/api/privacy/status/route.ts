import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  return NextResponse.json({
    compliance: "India DPDP Act 2023 Compliant",
    retentionPosture: "Zero Server-side Storage (Stateless Passthrough)",
    trainingOptOut: "Strict provider opt-out headers enabled",
    securityHeaders: {
      "Content-Security-Policy": "default-src 'self' 'unsafe-inline' 'unsafe-eval' https:; iframe-src 'self' data:;",
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
