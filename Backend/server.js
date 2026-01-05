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


/*
// 2. The Chat Route
app.post('/api/chat', validateFirebaseToken, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let isAborted = false;
  req.on('close', () => {
    console.log("Client closed connection. Stopping AI...");
    isAborted = true;
  });

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

    const historySnapshot = await convRef.collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(6)
      .get();

    const history = historySnapshot.docs.map(doc => ({
      role: doc.data().role,
      content: doc.data().content
    })).reverse();
    // 4. (Optional) Here is where you would call OpenAI/Ollama
    console.log("Requesting response from LM Studio...");
    
    const lmResponse = await fetch("http://localhost:1234/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "local-model",
        stream: true, // Enable streaming
        messages: [
          { role: "system", content: "You are LocalMind, a helpful assistant." },
          ...history,
          { role: "user", content: message }
        ],
      }),
    });

  if (!lmResponse.body) {
      throw new Error("No response body received from LM Studio");
    }

    const reader = lmResponse.body.getReader(); // This defines 'reader'
    const decoder = new TextDecoder();
    let fullAiResponse = "";

    console.log("Starting to read stream from LM Studio...");

    while (true) {

      if (isAborted) {
          console.log("STOP TRIGGERED: Connection lost. Wiping local data.");
          await reader.cancel(); // Kill the stream from LM Studio
          return; // EXIT IMMEDIATELY. This prevents the code below from ever running.
        }

      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;

        if (trimmed.startsWith("data: ")) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            const content = data.choices[0]?.delta?.content;
            if (content) {
              fullAiResponse += content;
              // Send token to frontend
              if (!isAborted) {
                res.write(`data: ${JSON.stringify({ content: data.content })}\n\n`);
              }
            }
          } catch (e) {
            console.error("Error parsing stream chunk:", e.message);
          }
        }
      }
    }
    console.log("Local AI replied!");

    // Save AI response to Firestore too
    if (!isAborted) {
      await convRef.collection('messages').add({
        content: fullAiResponse,
        role: 'assistant',
        ownerId: uid,
        timestamp: new Date()
      });
    }
    await convRef.update({ lastMessage: fullAiResponse });

    res.write(`data: ${JSON.stringify({ done: true, conversationId: convRef.id })}\n\n`);
    res.end();
    
  } catch (error) {
    console.error("Final Server Error:", error);
    // If headers were already sent, we can't send a 500, we just end the stream
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`);
      res.end();
    }
  }
});
*/



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