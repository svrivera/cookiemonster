const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const axios = require('axios');

const app = express();
const URL = 'http://blog.local';
const PORT = 3002;
const COOKIE_MONSTER_URL = 'http://cookiemonster.local:3001/update-cookies';

// Use cookie-parser middleware
app.use(cookieParser());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to send cookies to CookieMonster after each request
app.use(async (req, res, next) => {
  try {
    console.log('Cookies received by Blog:', req.cookies);
    const response = await axios.post(COOKIE_MONSTER_URL, {
      cookies: req.cookies,
      host: req.get('host')
    });

    if (response.data.monsterID) {
      console.log('Setting monsterID cookie:', response.data.monsterID);
      res.cookie('monsterID', response.data.monsterID, {
        maxAge: 900000,
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
      });
    } else {
      console.log('No monsterID received from CookieMonster');
    }
  } catch (error) {
    console.error('Error sending cookies to CookieMonster:', error);
  }
  next();
});
// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'blog.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Blog server is running on ${URL}:${PORT}`);
}).on('error', (error) => {
  console.error('Failed to start Blog server:', error);
});