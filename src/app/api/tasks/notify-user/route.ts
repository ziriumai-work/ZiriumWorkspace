import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

async function verifyFirebaseIdToken(idToken: string): Promise<boolean> {
  const fbApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!fbApiKey) return false;
  try {
    const isEmulator = process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "true";
    const endpoint = isEmulator
      ? `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:lookup?key=${fbApiKey}`
      : `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${fbApiKey}`;

    const res = await fetch(
      endpoint,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    // 1. CORS / Origin Validation
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin) {
      const isLocalhost = origin.includes("localhost") || origin.includes("127.0.0.1");
      const allowedAppUrl = process.env.NEXT_PUBLIC_APP_URL || "https://zirium.vercel.app";
      const isAllowedOrigin = origin === allowedAppUrl || isLocalhost || (host && origin.includes(host));
      if (!isAllowedOrigin) {
        return NextResponse.json({ error: "Forbidden: Invalid origin request" }, { status: 403 });
      }
    }

    // 2. Auth
    const authHeader = request.headers.get("Authorization") ?? "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const validToken = await verifyFirebaseIdToken(idToken);
    if (!validToken) {
      return NextResponse.json({ error: "Invalid or expired session token" }, { status: 401 });
    }

    const body = await request.json();
    const { userEmail, userName, taskTitle, targetTime, priority, category } = body;

    if (!userEmail || !taskTitle || !targetTime) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;
    const cleanUser = (gmailUser || "").trim();
    const cleanPass = (gmailPass || "").trim().replace(/\s+/g, "");

    if (!cleanUser || !cleanPass) {
      return NextResponse.json({ success: false, warning: "SMTP credentials missing" });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: cleanUser, pass: cleanPass },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    });

    let priorityColor = "#6B7280"; // default
    if (priority === "High") priorityColor = "#EF4444";
    else if (priority === "Medium") priorityColor = "#F59E0B";
    else if (priority === "Low") priorityColor = "#3B82F6";

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 30px; border: 1px solid #E5E7EB; border-radius: 12px; background-color: #FFFFFF;">
        <div style="margin-bottom: 24px; border-bottom: 1px solid #E5E7EB; padding-bottom: 16px;">
          <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: #111827;">Zirium Personal Reminder</h2>
        </div>
        
        <p style="font-size: 14px; color: #374151;">Hi ${userName || "there"},</p>
        <p style="font-size: 14px; color: #374151;">You have an upcoming personal task that is due soon:</p>

        <div style="background-color: #F9FAFB; border-radius: 8px; padding: 18px; margin: 24px 0;">
          <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #111827;">${taskTitle}</h3>
          
          <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
            <div>
              <span style="font-weight: 600; color: #6B7280; display: inline-block; width: 80px;">Due Time:</span>
              <span style="color: #111827; font-weight: 500;">${targetTime}</span>
            </div>
            <div>
              <span style="font-weight: 600; color: #6B7280; display: inline-block; width: 80px;">Priority:</span>
              <span style="color: ${priorityColor}; font-weight: 500;">${priority || "N/A"}</span>
            </div>
            <div>
              <span style="font-weight: 600; color: #6B7280; display: inline-block; width: 80px;">Category:</span>
              <span style="color: #111827;">${category || "N/A"}</span>
            </div>
          </div>
        </div>

        <p style="margin: 0; font-size: 12px; color: #9CA3AF; border-top: 1px solid #E5E7EB; padding-top: 16px;">
          This is an automated reminder from your Zirium Workspace Personal Tasks.
        </p>
      </div>
    `;

    const sendPromise = transporter.sendMail({
      from: `"Zirium Reminders" <${gmailUser}>`,
      to: userEmail,
      subject: `Reminder: ${taskTitle} at ${targetTime}`,
      html: htmlContent,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("SMTP connection timed out after 4000ms")), 4000)
    );

    await Promise.race([sendPromise, timeoutPromise]);

    console.log(`\n[Zirium Reminders] ✅ Successfully sent email notification to ${userEmail} for task: "${taskTitle}"\n`);

    return NextResponse.json({ success: true, message: `Email sent to ${userEmail}` });
  } catch (error: any) {
    console.error("Failed to send task reminder email:", error);
    return NextResponse.json({ success: false, warning: error.message || "Failed to send reminder" });
  }
}
