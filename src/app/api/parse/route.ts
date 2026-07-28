import { NextRequest, NextResponse } from "next/server";

// Parses uploaded file and extracts plain text.
// Uses mammoth for .docx, and raw UTF-8 decode for .txt/.csv.
// PDF uses a lightweight manual byte extraction to avoid Node-worker dependencies on Vercel.

async function extractPdfText(buffer: Buffer): Promise<string> {
  // Lightweight PDF text extraction without pdfjs-dist workers.
  // Reads raw PDF stream objects and strips binary/markup. Handles most text PDFs.
  const str = buffer.toString("latin1");
  const texts: string[] = [];

  // Match BT...ET blocks (PDF text objects)
  const btEt = str.match(/BT[\s\S]*?ET/g) || [];
  for (const block of btEt) {
    // Extract strings from Tj, TJ, ' and " operators
    const stringMatches = block.match(/\(([^)]*)\)\s*(?:Tj|'|")/g) || [];
    for (const m of stringMatches) {
      const inner = m.match(/\(([^)]*)\)/)?.[1] || "";
      texts.push(inner.replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\\\(/g, "(").replace(/\\\)/g, ")"));
    }
    // TJ arrays: [(text) number (text)]
    const tjArrays = block.match(/\[([^\]]*)\]\s*TJ/g) || [];
    for (const tj of tjArrays) {
      const parts = tj.match(/\(([^)]*)\)/g) || [];
      for (const p of parts) {
        texts.push(p.slice(1, -1).replace(/\\n/g, "\n").replace(/\\r/g, ""));
      }
    }
  }

  const result = texts.join(" ").replace(/\s+/g, " ").trim();

  // If extraction yielded almost nothing, return a readable notice instead of silently failing.
  if (result.length < 30) {
    return "PDF content could not be fully extracted. Please try a .docx or .txt file for best AI results.";
  }

  return result;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
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
  } catch (error: any) {
    console.error("File parse error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to parse file" },
      { status: 500 },
    );
  }
}
