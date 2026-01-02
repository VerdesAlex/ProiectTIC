const express = require('express');
const cors = require('cors');
const axios = require('axios');
const morgan = require('morgan');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(morgan('dev'));

app.use(cors());

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ 
    status: 'active', 
    message: 'LocalMind Backend is running',
    timestamp: new Date(),
    aiUrl: process.env.LOCAL_AI_API_URL
  });
});


app.listen(PORT, () => {
  console.log(`-------------------------------------------`);
  console.log(`Local AI Backend running on port ${PORT}`);
  console.log(`AI Service Target: ${process.env.LOCAL_AI_API_URL}`);
  console.log(`Logging System New Added (Morgan)`);
  console.log(`-------------------------------------------`);
});