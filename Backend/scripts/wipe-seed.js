/**
 * WIPE SCRIPT: Șterge toate datele de test pentru un utilizator specific
 * Utilizare: node scripts/wipe-seed.js <USER_UID>
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const USER_UID = process.argv[2];

if (!USER_UID) {
  console.error("❌ Eroare: Te rog specifică un User UID pentru wipe.");
  process.exit(1);
}

async function wipeData() {
  console.log(`🧹 Curățăm datele pentru user: ${USER_UID}...`);

  try {
    // 1. Găsim toate conversațiile utilizatorului
    const convsSnapshot = await db.collection('conversations')
      .where('ownerId', '==', USER_UID)
      .get();

    if (convsSnapshot.empty) {
      console.log("ℹ️ Nu am găsit conversații pentru acest UID.");
      return;
    }

    console.log(`🗑️ Am găsit ${convsSnapshot.size} conversații. Începe ștergerea mesajelor...`);

    for (const convDoc of convsSnapshot.docs) {
      const convId = convDoc.id;
      
      // 2. Ștergem mesajele din sub-colecția 'messages'
      const messagesSnapshot = await convDoc.ref.collection('messages').get();
      
      if (!messagesSnapshot.empty) {
        const batch = db.batch();
        messagesSnapshot.docs.forEach((msgDoc) => {
          batch.delete(msgDoc.ref);
        });
        await batch.commit();
        console.log(`   ∟ Mesaje șterse pentru conversația: ${convId}`);
      }

      // 3. Ștergem documentul conversației în sine
      await convDoc.ref.delete();
    }

    console.log('\n✨ Curățenie finalizată cu succes!');
  } catch (error) {
    console.error('🔴 Eroare la wipe:', error);
  } finally {
    process.exit();
  }
}

wipeData();