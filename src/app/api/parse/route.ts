import { NextRequest, NextResponse } from "next/server";
import * as mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";

    const name = file.name.toLowerCase();

    if (name.endsWith(".pdf")) {
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map((item: any) => item.str);
        fullText += strings.join(" ") + "\\n";
      }
      text = fullText;
    } else if (name.endsWith(".docx") || name.endsWith(".doc")) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      text = buffer.toString("utf-8");
    }

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error("File parse error:", error);
    return NextResponse.json({ error: error.message || "Failed to parse file" }, { status: 500 });
  }
}
