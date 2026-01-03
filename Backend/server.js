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
  try {
    const { message, conversationId } = req.body;
    const { uid } = req.user;

    let convRef;

    if (conversationId) {
      // 1. Use existing conversation
      convRef = db.collection('conversations').doc(conversationId);
    } else {
      // 2. Create new conversation
      convRef = db.collection('conversations').doc();
      await convRef.set({
        ownerId: uid,
        createdAt: new Date(),
        title: message.length > 30 ? message.substring(0, 30) + '...' : message,
        lastMessage: message
      });
    }

    // 3. Save the message to the sub-collection
    await convRef.collection('messages').add({
      content: message,
      role: 'user',
      ownerId: uid,
      timestamp: new Date()
    });

    // 4. (Optional) Here is where you would call OpenAI/Ollama
    const aiResponse = "I have received your message and saved it!";

    // Save AI response to Firestore too
    await convRef.collection('messages').add({
      content: aiResponse,
      role: 'assistant',
      ownerId: uid,
      timestamp: new Date()
    });

    res.json({ 
      success: true, 
      conversationId: convRef.id, 
      aiResponse: aiResponse 
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server heart beating on http://localhost:${PORT}`);
});