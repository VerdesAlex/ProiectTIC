/**
 * SEED SCRIPT: Generare date fictive pentru Firestore
 * Utilizare: node scripts/seed.js <USER_UID>
 */

const admin = require('firebase-admin');
const { faker } = require('@faker-js/faker');

// 1. Configurare Firebase Admin
// Asigură-te că ai descărcat fișierul json din Firebase Console
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Preluare UID din argumente
const USER_UID = process.argv[2];

if (!USER_UID) {
  console.error("❌ Eroare: Te rog specifică un User UID ca argument.");
  console.log("Exemplu: node scripts/seed.js 12345abcde");
  process.exit(1);
}

async function seedData() {
  console.log(`🚀 Începe generarea datelor pentru utilizatorul: ${USER_UID}...`);

  try {
    const conversationsCount = 5;

    for (let i = 0; i < conversationsCount; i++) {
      // Creare referință document conversație
      const convRef = db.collection('conversations').doc();
      
      // Timestamp de bază pentru conversație (acum X zile)
      let conversationDate = faker.date.recent({ days: 7 });

      const conversationData = {
        ownerId: USER_UID,
        title: faker.lorem.sentence({ min: 2, max: 4 }),
        createdAt: admin.firestore.Timestamp.fromDate(conversationDate),
        updatedAt: admin.firestore.Timestamp.fromDate(conversationDate),
        lastMessage: "" // Va fi actualizat după generarea mesajelor
      };

      await convRef.set(conversationData);
      console.log(`✅ Creat conversația: ${convRef.id}`);

      // Generare mesaje (10-15 per conversație)
      const messageCount = faker.number.int({ min: 10, max: 15 });
      const messagesBatch = db.batch();
      
      let lastMsgText = "";

      for (let j = 0; j < messageCount; j++) {
        const msgRef = convRef.collection('messages').doc();
        
        // Incrementăm timpul cu câteva minute pentru fiecare mesaj pentru a păstra ordinea
        conversationDate = new Date(conversationDate.getTime() + (j * 60000 * 5)); 
        
        const role = j % 2 === 0 ? 'user' : 'assistant';
        const content = role === 'user' 
          ? faker.lorem.sentence() 
          : faker.lorem.paragraph();

        lastMsgText = content;

        messagesBatch.set(msgRef, {
          content: content,
          role: role,
          createdAt: admin.firestore.Timestamp.fromDate(conversationDate)
        });
      }

      // Actualizăm conversația cu ultimul mesaj pentru UI
      await messagesBatch.commit();
      await convRef.update({
        lastMessage: lastMsgText,
        updatedAt: admin.firestore.Timestamp.fromDate(conversationDate)
      });

      console.log(`   ∟ Adăugat ${messageCount} mesaje.`);
    }

    console.log('\n✨ Seed-ul a fost finalizat cu succes!');
  } catch (error) {
    console.error('🔴 Eroare la seeding:', error);
  } finally {
    process.exit();
  }
}

seedData();