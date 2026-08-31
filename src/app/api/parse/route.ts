import { NextRequest, NextResponse } from "next/server";

// Parses uploaded file and extracts plain text.
// Uses mammoth for .docx, and raw UTF-8 decode for .txt/.csv.
// PDF uses a lightweight manual byte extraction to avoid Node-worker dependencies on Vercel.

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

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

async function extractPdfText(buffer: Buffer): Promise<string> {
  // Lightweight PDF text extraction without pdfjs-dist workers.
  const str = buffer.toString("latin1");
  const texts: string[] = [];

  const btEt = str.match(/BT[\s\S]*?ET/g) || [];
  for (const block of btEt) {
    const stringMatches = block.match(/\(([^)]*)\)\s*(?:Tj|'|")/g) || [];
    for (const m of stringMatches) {
      const inner = m.match(/\(([^)]*)\)/)?.[1] || "";
      texts.push(inner.replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\\\(/g, "(").replace(/\\\)/g, ")"));
    }
    const tjArrays = block.match(/\[([^\]]*)\]\s*TJ/g) || [];
    for (const tj of tjArrays) {
      const parts = tj.match(/\(([^)]*)\)/g) || [];
      for (const p of parts) {
        texts.push(p.slice(1, -1).replace(/\\n/g, "\n").replace(/\\r/g, ""));
      }
    }
  }

  const result = texts.join(" ").replace(/\s+/g, " ").trim();

  if (result.length < 30) {
    return "PDF content could not be fully extracted. Please try a .docx or .txt file for best AI results.";
  }

  return result;
}

export async function POST(req: NextRequest) {
  try {
    // Auth gate: require a valid Firebase ID token
    const authHeader = req.headers.get("Authorization") ?? "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!idToken) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const valid = await verifyFirebaseIdToken(idToken);
    if (!valid) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // File size limit: 5 MB max to prevent DoS via large uploads
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File too large. Maximum allowed size is ${MAX_FILE_BYTES / (1024 * 1024)}MB.` },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name.toLowerCase();
    let text = "";

    if (name.endsWith(".pdf")) {
      text = await extractPdfText(buffer);
    } else if (name.endsWith(".docx") || name.endsWith(".doc")) {
      // Dynamic import so mammoth doesn't load on routes that don't need it.
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      // Plain text, CSV, JSON, Markdown etc.
      text = buffer.toString("utf-8");
    }

    return NextResponse.json({ text });
  } catch (error: unknown) {
    console.error("File parse error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to parse file" },
      { status: 500 },
    );
  }
}
