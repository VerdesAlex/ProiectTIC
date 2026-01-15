const admin = require('firebase-admin');
// const serviceAccount = require('../serviceAccountKey.json');

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) 
  : require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// We export 'db' for data operations and 'admin' for auth/utility tasks
module.exports = { admin, db };