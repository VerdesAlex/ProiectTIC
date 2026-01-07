/* fisier: Backend/server.js */
const dotenv = require('dotenv').config();
const express = require('express');
const validateFirebaseToken = require('./middleware/authMiddleware');
const { db } = require('./firebase/config');
const app = express();
const cors = require('cors');
const morgan = require('morgan');

const API_URL = process.env.LOCAL_AI_API_URL || "v1/chat/completions";
// const ADDRESS = process.env.ADDRESS || "http://localhost:1234";
const DEFAULT_SYSTEM_PROMPT = "You are LocalMind, a helpful and intelligent AI assistant.";

// Middleware
app.use(cors({
  origin: ['https://proiect-tic.vercel.app', 'http://localhost:5173'], // Adaugă URL-ul tău de Vercel
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());

// Logging simplu pentru request-uri
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Health Check
app.get('/test', (req, res) => {
  res.send('Server is reachable!');
});

// --- RUTA PRINCIPALĂ DE CHAT CU STOP GENERATION ---
app.post('/api/chat', validateFirebaseToken, async (req, res) => {
  // Configurare SSE (Server-Sent Events)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // 1. Controller intern pentru a putea opri cererea către AI-ul Local
  const aiAbortController = new AbortController();
  const { signal } = aiAbortController;
  
  let isAborted = false;

  // 2. DETECTAREA STOPULUI DE CĂTRE USER
  // Când frontend-ul apelează abort(), conexiunea HTTP se închide.
  req.on('close', () => {
    if (!res.writableEnded) {
      console.log("🛑 Client closed connection. Aborting AI generation...");
      isAborted = true;
      aiAbortController.abort(); // Oprește request-ul către LM Studio
    }
  });

  try {
    const { message, conversationId, systemPrompt, title } = req.body;
    const { uid } = req.user;

    // --- A. Configurare Conversație în Firestore ---
    let convRef;
    let currentSystemPrompt = systemPrompt || DEFAULT_SYSTEM_PROMPT;

    if (conversationId) {
      convRef = db.collection('conversations').doc(conversationId);
      const doc = await convRef.get();
      if (doc.exists) {
        const data = doc.data();
        if (data.systemPrompt) currentSystemPrompt = data.systemPrompt;
      }
    } else {
      convRef = db.collection('conversations').doc();
      await convRef.set({ 
        ownerId: uid, 
        createdAt: new Date(), 
        title: title || message.slice(0, 30),
        systemPrompt: currentSystemPrompt 
      });
    }

    // Salvăm mesajul userului
    await convRef.collection('messages').add({ 
      content: message, 
      role: 'user', 
      ownerId: uid, 
      timestamp: new Date() 
    });

    // --- B. Pregătire Payload pentru AI ---
    const messagesPayload = [
      { role: "system", content: currentSystemPrompt },
      { role: "user", content: message }
    ];

    console.log(`🧠 Sending to AI (User: ${uid})...`);

    // --- C. Apel către AI Local (LM Studio) ---
    const lmResponse = await fetch(`${API_URL}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        model: "local-model", 
        stream: true, 
        messages: messagesPayload,
        temperature: 0.7 
      }),
      signal: signal // <--- AICI se transmite semnalul de oprire
    }).catch(err => {
      if (err.name === 'AbortError') {
        throw new Error("Aborted by user during fetch setup");
      }
      throw err;
    });

    const reader = lmResponse.body.getReader();
    const decoder = new TextDecoder();
    let fullAiResponse = "";

    // --- D. Procesare Stream ---
    while (true) {
      if (isAborted) break; // Verificare rapidă

      try {
        const { done, value } = await reader.read();
        
        if (done) break;
        if (isAborted) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const data = JSON.parse(line.slice(6));
              const content = data.choices[0]?.delta?.content;
              
              if (content) {
                fullAiResponse += content;
                // Trimitem chunk către frontend doar dacă e activ
                if (!isAborted && !res.writableEnded) {
                  res.write(`data: ${JSON.stringify({ content })}\n\n`);
                }
              }
            } catch (e) {
              // Ignorăm erorile de parse pe fragmente incomplete
            }
          }
        }
      } catch (readError) {
        if (readError.name === 'AbortError' || isAborted) {
          console.log("🛑 Stream reading aborted successfully.");
          break;
        }
        throw readError;
      }
    }

    // --- E. Finalizare ---
    // Salvăm în DB DOAR dacă NU a fost oprit
    if (!isAborted) {
      await convRef.collection('messages').add({ 
        content: fullAiResponse, 
        role: 'assistant', 
        ownerId: uid, 
        timestamp: new Date() 
      });
      
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ done: true, conversationId: convRef.id })}\n\n`);
        res.end();
      }
    } else {
      console.log("⚠️ Generation stopped by user. Message NOT saved to DB.");
      if (!res.writableEnded) res.end();
    }

  } catch (error) {
    // Ignorăm eroarea de abort fiindcă e intenționată
    if (error.message === "Aborted by user during fetch setup" || isAborted) {
      console.log("✅ Request cleaned up.");
    } else {
      console.error("Server Error:", error);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: "Processing failed" })}\n\n`);
        res.end();
      }
    }
  }
});

// --- ALTE RUTE ---

app.get('/api/conversations', validateFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.user;
    const { search } = req.query;

    const snapshot = await db.collection('conversations')
      .where('ownerId', '==', uid)
      .orderBy('createdAt', 'desc')
      .get();

    let conversations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (search) {
      const searchTerm = search.toLowerCase();
      conversations = conversations.filter(conv => 
        (conv.title && conv.title.toLowerCase().includes(searchTerm))
      );
    }

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/conversations/:id/messages', validateFirebaseToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { uid } = req.user;

    const convRef = db.collection('conversations').doc(id);
    const doc = await convRef.get();

    if (!doc.exists || doc.data().ownerId !== uid) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const messagesSnapshot = await convRef.collection('messages').orderBy('timestamp', 'asc').get();
    const messages = messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/conversations/:id', validateFirebaseToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { uid } = req.user;

    const convRef = db.collection('conversations').doc(id);
    const doc = await convRef.get();

    if (!doc.exists || doc.data().ownerId !== uid) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await db.recursiveDelete(convRef);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server heart beating on port ${PORT}`);
});