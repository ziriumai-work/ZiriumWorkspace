import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * POST /api/auth/setup-first-user
 *
 * Sets up the very first user in the system by giving them the 'owner' role
 * and creating a 'developer' record for them with 'admin' access level.
 *
 * Body: { uid: string, email: string, name: string }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { uid, email, name } = body;

    if (!uid || !email) {
      return NextResponse.json({ error: "missing uid or email" }, { status: 400 });
    }

    const db = getAdminDb();
    
    // Security check: only allow if developers collection is completely empty
    const allDevs = await db.collection("developers").limit(1).get();
    if (!allDevs.empty) {
      return NextResponse.json(
        { error: "Setup for first user is no longer allowed. The system already has users." },
        { status: 403 }
      );
    }

    const batch = db.batch();

    // 1. Create the member doc with 'owner' role
    const memberRef = db.collection("members").doc(uid);
    batch.set(memberRef, {
      uid,
      role: "owner",
      teamIds: [],
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // 2. Create the developer doc with 'admin' accessLevel
    const newDevRef = db.collection("developers").doc();
    batch.set(newDevRef, {
      uid,
      name: (name || "Admin User").trim(),
      email: email.trim().toLowerCase(),
      jobTitle: "Owner",
      role: "owner",
      department: "custom",
      customDepartment: "Management",
      employmentType: "full_time",
      startDate: new Date().toISOString().split("T")[0],
      status: "active",
      accessLevel: "admin",
      monthlySalary: null,
      officeHours: null,
      flexibilityHours: null,
      createdAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[setup-first-user] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
