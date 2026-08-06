import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/firebaseAdmin";

/**
 * POST /api/auth/check-email
 *
 * Checks whether a given email exists in the /developers collection.
 * This is called BEFORE creating a Firebase Auth account during registration
 * so that unregistered emails are rejected without creating any Auth or Firestore
 * documents.
 *
 * Body: { email: string }
 * Response 200: { allowed: true,  name: string }
 * Response 403: { allowed: false, message: string }
 * Response 400: { error: "missing email" }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email: string = (body?.email ?? "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "missing email" }, { status: 400 });
    }

    const db = getAdminDb();
    
    // Check if this is the very first user registering in the system
    const allDevs = await db.collection("developers").limit(1).get();
    console.log("[check-email] allDevs.empty:", allDevs.empty);
    if (!allDevs.empty) {
      console.log("[check-email] first dev found:", allDevs.docs[0].data());
    }

    if (allDevs.empty) {
      console.log("[check-email] allowing first user");
      return NextResponse.json({ allowed: true, isFirstUser: true, name: "" });
    }

    const snap = await db
      .collection("developers")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json(
        {
          allowed: false,
          message:
            "Your email is not registered in the system. Please contact your administrator to be added before registering.",
        },
        { status: 403 },
      );
    }

    const dev = snap.docs[0].data();
    return NextResponse.json({ allowed: true, name: dev.name ?? "" });
  } catch (err) {
    console.error("[check-email] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
