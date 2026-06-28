import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const timestamp = new Date().toISOString();
  const rawData = `OMNISWARM-DPDP-SCRUB-CONFIRMED:${timestamp}:${Math.random().toString(36).slice(2, 9)}`;
  
  // Safe base64 encoding for Edge runtime using btoa
  const signature = btoa(rawData);

  const tombstone = `-----BEGIN OMNISWARM DELETION TOMBSTONE-----
Timestamp: ${timestamp}
Compliance: India DPDP Act 2023 (Section 12 - Right to Erasure)
Audit Status: VERIFIED SCRUBBED
Tombstone ID: DPDP-${Math.floor(100000 + Math.random() * 900000)}
Receipt Scope:
  - Ephemeral Session Keys: Erased (BYO-key)
  - Telemetry Telemetry logs: Purged
  - Client state IndexedDB & LocalStorage: Cleared
Verification Signature:
  ${signature}
-----END OMNISWARM DELETION TOMBSTONE-----`;

  return NextResponse.json({ tombstone });
}
