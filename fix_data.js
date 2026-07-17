const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc } = require("firebase/firestore");

const firebaseConfig = {
  projectId: "zirium-workspace",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("Fetching attendance records...");
  const snap = await getDocs(collection(db, "attendance"));
  
  let deletedCount = 0;
  let updatedCount = 0;
  
  for (const d of snap.docs) {
    const data = d.data();
    
    // Check if checkIn is missing or invalid but hoursWorked is insanely high
    if (data.hoursWorked > 100) {
      console.log(`Fixing corrupted record: ${d.id}`, data);
      
      // If no checkIn time, it was an "On Leave" or error that got auto-clocked out.
      // We'll set hoursWorked to 0, checkOut to null.
      if (!data.checkIn) {
        await updateDoc(d.ref, {
          hoursWorked: 0,
          checkOut: null
        });
        updatedCount++;
      } else {
        // Recalculate if possible, otherwise delete.
        // For safety, let's just delete incredibly large corrupted records if checkIn exists but is invalid
        await updateDoc(d.ref, {
          hoursWorked: 0,
          checkOut: null
        });
        updatedCount++;
      }
    }
  }
  
  console.log(`Done. Updated ${updatedCount} corrupted records.`);
}

run().catch(console.error);
