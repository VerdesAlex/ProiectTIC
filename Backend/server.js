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
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// 1. Health Check Route (To test if the server is alive at all)
app.get('/test', (req, res) => {
  res.send('Server is reachable!');
});


app.post('/api/chat', validateFirebaseToken, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // --- NEW: ABORT LOGIC ---
  let isAborted = false;
  req.on('close', () => {
    isAborted = true;
    console.log("🛑 Client closed connection. Stopping AI...");
  });

  try {
    const { message, conversationId } = req.body;
    const { uid } = req.user;

    let convRef = conversationId 
      ? db.collection('conversations').doc(conversationId) 
      : db.collection('conversations').doc();

    if (!conversationId) {
      await convRef.set({ ownerId: uid, createdAt: new Date(), title: message.slice(0, 30) });
    }

    await convRef.collection('messages').add({ content: message, role: 'user', ownerId: uid, timestamp: new Date() });

    const lmResponse = await fetch("http://localhost:1234/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "local-model", stream: true, messages: [{ role: "user", content: message }] }),
    });

    const reader = lmResponse.body.getReader();
    const decoder = new TextDecoder();
    let fullAiResponse = "";

    while (true) {
      // --- CHECK FOR ABORT ---
      if (isAborted) {
        await reader.cancel();
        return; // Stop everything and don't save to DB
      }

      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try {
            const data = JSON.parse(line.slice(6));
            const content = data.choices[0]?.delta?.content;
            if (content) {
              fullAiResponse += content;
              if (!isAborted) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
              }
            }
          } catch (e) {}
        }
      }
    }

    // --- ONLY SAVE IF NOT ABORTED ---
    if (!isAborted) {
      await convRef.collection('messages').add({ content: fullAiResponse, role: 'assistant', ownerId: uid, timestamp: new Date() });
      res.write(`data: ${JSON.stringify({ done: true, conversationId: convRef.id })}\n\n`);
      res.end();
    }

  } catch (error) {
    console.error("Server Error:", error);
    if (!res.writableEnded) res.end();
  }
});

/* working but has no stop btn
app.post('/api/chat', validateFirebaseToken, async (req, res) => {
  // Set headers for streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const { message, conversationId } = req.body;
    const { uid } = req.user;

    // Standard Firestore Setup
    let convRef = conversationId 
      ? db.collection('conversations').doc(conversationId) 
      : db.collection('conversations').doc();

    if (!conversationId) {
      await convRef.set({ ownerId: uid, createdAt: new Date(), title: message.slice(0, 30) });
    }

    await convRef.collection('messages').add({ content: message, role: 'user', ownerId: uid, timestamp: new Date() });

    // Call LM Studio
    const lmResponse = await fetch("http://localhost:1234/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "local-model", stream: true, messages: [{ role: "user", content: message }] }),
    });

    const reader = lmResponse.body.getReader();
    const decoder = new TextDecoder();
    let fullAiResponse = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try {
            const data = JSON.parse(line.slice(6));
            const content = data.choices[0]?.delta?.content;
            if (content) {
              fullAiResponse += content;
              // SEND TO FRONTEND
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          } catch (e) {}
        }
      }
    }

    // Final Database Save
    await convRef.collection('messages').add({ content: fullAiResponse, role: 'assistant', ownerId: uid, timestamp: new Date() });
    
    // Signal end of stream
    res.write(`data: ${JSON.stringify({ done: true, conversationId: convRef.id })}\n\n`);
    res.end();

  } catch (error) {
    console.error("Server Error:", error);
    res.end();
  }
});
*/
// New route for recursive deletion
app.delete('/api/conversation/:id', validateFirebaseToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { uid } = req.user;

    const convRef = db.collection('conversations').doc(id);
    const doc = await convRef.get();

    // Security: Only allow deletion if the user owns the chat
    if (!doc.exists || doc.data().ownerId !== uid) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // This command recursively deletes the document and all sub-collections
    await db.recursiveDelete(convRef);

    res.json({ success: true, message: "Conversation and all messages deleted." });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server heart beating on http://localhost:${PORT}`);
});