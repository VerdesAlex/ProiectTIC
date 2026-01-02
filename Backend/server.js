const express = require('express');
const validateFirebaseToken = require('./middleware/authMiddleware');
const { db } = require('./firebase/config'); // Import the Firestore instance
const app = express();
const cors = require('cors');
const morgan = require('morgan');

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// 1. Health Check Route (To test if the server is alive at all)
app.get('/test', (req, res) => {
  res.send('Server is reachable!');
});

// 2. The Chat Route
app.post('/api/chat', validateFirebaseToken, async (req, res) => {
  console.log("Route /api/chat hit!");
  try {
    const { message } = req.body;
    const { uid } = req.user;

    const convRef = db.collection('conversations').doc();
    await convRef.set({
      ownerId: uid,
      createdAt: new Date(),
      lastMessage: message
    });

    res.json({ success: true, message: "Firestore write successful!" });
  } catch (error) {
    console.error("Firestore Error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server heart beating on http://localhost:${PORT}`);
});