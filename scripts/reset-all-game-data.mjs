import admin from 'firebase-admin';
import process from 'process';

const DELETE_COLLECTION_ALLOWLIST = [
  "users",
  "processedGameSessions_v4",
  "adminGrantHistory",
  "rankings_v4"
];

try {
  admin.initializeApp({
    projectId: "gugu-cat-adventrue"
  });
} catch (e) {
  // Ignore already initialized error
}

const db = admin.firestore();

const args = process.argv.slice(2);
const confirmIndex = args.indexOf('--confirm');
const isConfirm = confirmIndex >= 0 && args[confirmIndex + 1] === 'RESET_NYANKO_GAME_DATA';

async function run() {
  if (!isConfirm) {
    console.log("[DRY RUN]\n");
    
    for (const col of DELETE_COLLECTION_ALLOWLIST) {
      try {
        const snap = await db.collection(col).get();
        console.log(`${col}: ${snap.size} documents`);
      } catch (err) {
        console.error(`Error querying ${col}:`, err.message);
      }
    }
    
    console.log("\nNo data was deleted.");
    process.exit(0);
  }

  console.log("=== STARTING ACTUAL GAME DATA RESET ===");
  
  for (const col of DELETE_COLLECTION_ALLOWLIST) {
    try {
      const snap = await db.collection(col).get();
      console.log(`Deleting ${snap.size} documents from '${col}'...`);
      
      const batchSize = 100;
      let batch = db.batch();
      let count = 0;
      
      for (const doc of snap.docs) {
        batch.delete(doc.ref);
        count++;
        if (count % batchSize === 0) {
          await batch.commit();
          batch = db.batch();
        }
      }
      
      if (count % batchSize !== 0) {
        await batch.commit();
      }
      console.log(`Successfully deleted ${count} documents from '${col}'.`);
    } catch (err) {
      console.error(`Error deleting from ${col}:`, err.message);
    }
  }
  
  console.log("\n=== RESET NYANKO GAME DATA COMPLETE ===");
  process.exit(0);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
