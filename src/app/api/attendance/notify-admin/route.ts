import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/firebaseAdmin";

export async function POST(request: Request) {
  try {
    // 1. CORS / Origin Validation (CSRF Protection)
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin) {
      const isLocalhost = origin.includes("localhost") || origin.includes("127.0.0.1");
      const allowedAppUrl = process.env.NEXT_PUBLIC_APP_URL || "https://zirium.vercel.app";
      const isAllowedOrigin = origin === allowedAppUrl || isLocalhost || (host && origin.includes(host));
      if (!isAllowedOrigin) {
        return NextResponse.json(
          { error: "Forbidden: Invalid origin request" },
          { status: 403 }
        );
      }
    }

    // 2. Firebase Session Authentication Gate
    const authHeader = request.headers.get("Authorization") ?? "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    let validToken = false;
    try {
      await getAdminAuth().verifyIdToken(idToken);
      validToken = true;
    } catch {
      // Identity Toolkit REST API Fallback
      const fbApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      if (fbApiKey) {
        try {
          const res = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${fbApiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ idToken }),
            }
          );
          validToken = res.ok;
        } catch {
          validToken = false;
        }
      }
    }

    if (!validToken) {
      return NextResponse.json(
        { error: "Invalid or expired session token" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      userName,
      userEmail,
      userAvatar,
      action,
      exactTime,
      adminEmails: clientAdminEmails,
    } = body;
    console.log("notify-admin POST triggered:", {
      userName,
      action,
      exactTime,
      clientAdminEmails,
    });

    if (!userName || !action || !exactTime) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const adminEmailsSet = new Set<string>();

    if (Array.isArray(clientAdminEmails) && clientAdminEmails.length > 0) {
      clientAdminEmails.forEach((em: string) => {
        if (em && typeof em === "string") adminEmailsSet.add(em);
      });
    } else {
      try {
        const db = getAdminDb();
        const membersSnap = await db.collection("members").get();
        for (const memberDoc of membersSnap.docs) {
          const data = memberDoc.data();
          if ((data.role === "owner" || data.role === "admin") && data.subscribeToEmails === true && data.email) {
            adminEmailsSet.add(data.email as string);
          }
        }
      } catch (err) {
        console.warn("Server-side fallback email query failed:", err);
      }
    }

    const adminEmails = Array.from(adminEmailsSet);
    console.log("Found subscribed admin emails:", adminEmails);

    if (adminEmails.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No subscribed admins found",
      });
    }

    const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;

    const cleanUser = (gmailUser || "").trim();
    const cleanPass = (gmailPass || "").trim().replace(/\s+/g, "");

    if (!cleanUser || !cleanPass) {
      console.warn("Gmail App Password / User not configured in server env");
      return NextResponse.json({
        success: false,
        warning: "Gmail SMTP credentials not configured on server",
      });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: cleanUser,
        pass: cleanPass,
      },
    });

    const isClockIn = action === "Clock In";
    const badgeBg = isClockIn ? "#10B981" : "#F97316";
    const avatarUrl =
      userAvatar && userAvatar.startsWith("http")
        ? userAvatar
        : "https://zirium.vercel.app/default-avatar.png";

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 30px; border: 1px solid #E5E7EB; border-radius: 12px; background-color: #FFFFFF;">
        <div style="margin-bottom: 24px; border-bottom: 1px solid #E5E7EB; padding-bottom: 16px;">
          <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: #111827;">Zirium Workspace Attendance</h2>
        </div>
        
        <div style="display: flex; align-items: center; margin-bottom: 24px;">
          <img src="${avatarUrl}" alt="${userName}" style="width: 54px; height: 54px; border-radius: 50%; object-fit: cover; margin-right: 16px; border: 2px solid #E5E7EB;" />
          <div>
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1F2937;">${userName}</h3>
            <p style="margin: 4px 0 0; font-size: 13px; color: #6B7280;">${userEmail || "Employee"}</p>
          </div>
        </div>

        <div style="background-color: #F9FAFB; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
          <div style="margin-bottom: 12px;">
            <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #6B7280; display: block; margin-bottom: 6px;">Action</span>
            <span style="display: inline-block; background-color: ${badgeBg}; color: #FFFFFF; font-size: 13px; font-weight: 600; padding: 4px 10px; border-radius: 6px;">
              ${action}
            </span>
          </div>
          <div>
            <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #6B7280; display: block; margin-bottom: 4px;">Time Recorded</span>
            <span style="font-size: 14px; font-weight: 500; color: #111827;">${exactTime}</span>
          </div>
        </div>

        <p style="margin: 0; font-size: 12px; color: #9CA3AF; border-top: 1px solid #E5E7EB; padding-top: 16px;">
          You received this email because you opted into non-admin attendance alerts on your Zirium Admin dashboard.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Zirium Attendance" <${gmailUser}>`,
      to: adminEmails.join(", "),
      subject: `[Zirium Attendance] ${userName} — ${action} at ${exactTime}`,
      html: htmlContent,
    });

    return NextResponse.json({
      success: true,
      message: `Email sent to ${adminEmails.length} admin(s)`,
    });
  } catch (error: any) {
    console.error("Failed to send admin notification email:", error);
    return NextResponse.json({
      success: false,
      warning: error.message || "Failed to send email notification",
    });
  }
}
