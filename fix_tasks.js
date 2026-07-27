const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, doc, updateDoc } = require("firebase/firestore");

const firebaseConfig = {
  projectId: "zirium-workspace",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("Fetching tasks...");
  const snap = await getDocs(collection(db, "tasks"));
  
  let updatedCount = 0;
  
  for (const d of snap.docs) {
    const data = d.data();
    
    if (data.isOvertime && data.compensatesWeeklyHours && data.overtimeCost > 0) {
      console.log(`Fixing corrupted task: ${d.id}`, data);
      
      await updateDoc(d.ref, {
        overtimeCost: 0
      });
      updatedCount++;
    }
  }
  
  console.log(`Done. Updated ${updatedCount} corrupted tasks.`);
}

run().catch(console.error);
