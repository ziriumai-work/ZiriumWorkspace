# Security Vulnerabilities & Hardening Plan

You asked how the student was able to exploit the system. I have investigated your `firestore.rules` and found exactly how they did it, along with several other critical vulnerabilities that leave your database wide open.

Because the `.env` file contains your public Firebase config (API Key, Project ID, etc.), anyone can connect to your database using the standard Firebase JavaScript SDK. The only thing stopping them from destroying your data is `firestore.rules`. Unfortunately, the current rules have massive loopholes.

## How the Student Exploited It (The "Role Escalation" Attack)

1. **Step 1: Create an Account.** Using the public API keys from `.env`, the student initialized a Firebase app on their own computer and called `createUserWithEmailAndPassword()` to get a valid Firebase Auth UID.
2. **Step 2: Become a Member.** Your `firestore.rules` for the `/members` collection correctly forces new users to set their role to `'member'` when creating their initial document. They did exactly this.
3. **Step 3: Escalate to Owner.** Your `update` rule for the `/members` collection states:
   `allow update: if isAdmin() || (isSignedIn() && request.auth.uid == uid);`
   **The Flaw:** This rule allows a user to update their own member document, but it *doesn't restrict which fields they can change*. The student simply ran `db.collection('members').doc(myUid).update({ role: 'owner' })`. The database allowed it because they were updating their own document!

Once they had the `owner` role, they became a full admin and bypassed all other security rules.

## Other Critical Vulnerabilities Found

Even if they hadn't escalated to `owner`, the current rules for normal "members" are far too permissive:

- **Developer Roster Tampering:** The `/developers` collection allows `update: if isMember()`. This means any standard employee can edit the salary, job title, and access level of **any other employee** in the company.
- **Salaries Exposure:** The `/salaries` collection allows `read, update: if isMember()`. Any employee can read and modify everyone's salary payouts.
- **Attendance Tampering:** The `/attendance` collection allows `update: if isMember()`. An employee can modify their own past attendance records (or even other employees' records) to remove lates or add fake hours.
- **Personal Tasks Exposure:** The `/personal_tasks` collection allows `read, write: if isSignedIn()`. It does not check if the signed-in user actually owns the task, meaning any signed-in user can read and delete everyone else's personal tasks.

## Proposed Changes (Implementation Plan)

I propose heavily locking down `firestore.rules` to permanently fix these exploits.

### 1. Fix Role Escalation (`/members`)
#### [MODIFY] `firebase/firestore.rules`
- Restrict the `update` rule so non-admins can only update non-role fields.
  ```javascript
  allow update: if isAdmin() || (
    isSignedIn() && request.auth.uid == uid &&
    !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role'])
  );
  ```

### 2. Lock Down Developer Roster (`/developers`)
#### [MODIFY] `firebase/firestore.rules`
- Change `allow update: if isMember()` to `allow update: if isAdmin()`. Employees should not be able to edit the core developer documents (this should be admin-only).

### 3. Lock Down Salaries (`/salaries`)
#### [MODIFY] `firebase/firestore.rules`
- Change `allow read, update: if isMember()` so that only admins can access the salaries collection (as intended by the comments in the file).

### 4. Lock Down Attendance (`/attendance`)
#### [MODIFY] `firebase/firestore.rules`
- Ensure members can only create/update **their own** attendance records, not others.
- (Optional but recommended) Prevent members from modifying records from past days to prevent retroactively changing their attendance.

### 5. Secure Personal Tasks (`/personal_tasks`)
#### [MODIFY] `firebase/firestore.rules`
- Change `allow read, write: if isSignedIn()` to ensure they only access tasks where `uid == request.auth.uid`.

---
> [!IMPORTANT]
> **User Review Required:** Do you approve these security fixes? Once approved, I will implement them immediately to secure your database.
