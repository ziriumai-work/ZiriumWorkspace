import { NextRequest, NextResponse } from "next/server";

// Verifies Firebase ID token using Google's public REST API.
async function verifyFirebaseIdToken(idToken: string): Promise<boolean> {
  const fbApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!fbApiKey) return false;
  try {
    const isEmulator = process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "true";
    const endpoint = isEmulator
      ? `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:lookup?key=${fbApiKey}`
      : `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${fbApiKey}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// GET /api/time — returns authenticated server time.
// Requires a valid Firebase ID token to prevent unauthorized probing.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!idToken) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const valid = await verifyFirebaseIdToken(idToken);
  if (!valid) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  return NextResponse.json({ iso: new Date().toISOString() });
}
