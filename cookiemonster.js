const express = require('express');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const URL = 'http://cookiemonster.local';
const PORT = 3001;

app.use(express.json({
  verify: (req, res, buf, encoding) => {
    req.rawBody = buf;
  }
}));

app.use(cors({
  origin: 'http://marketplace.local:3000',
  credentials: true
}));

// Store all sent IDs and received cookies
let sentIDs = [];
let receivedCookies = {};

app.get('/', (req, res) => {
  console.log('Received request for root path');
  res.sendFile(path.join(__dirname, 'public', 'cookiemonster.html'));
});

app.post('/update-cookies', (req, res) => {
  try {
    // Parse the raw body
    let parsedBody;
    try {
      parsedBody = JSON.parse(req.rawBody.toString());
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      parsedBody = { cookies: {}, originalBody: {} };
    }

    const { cookies, originalBody } = parsedBody;
    console.log('Received request body:', parsedBody);
    console.log('Received cookies:', cookies);
    console.log('Original body:', originalBody);

    const safeHost = 'unknown_host';

    // Initialize host-specific cookie storage if it doesn't exist
    if (!receivedCookies[safeHost]) {
      receivedCookies[safeHost] = {};
    }

    // Update receivedCookies with host information
    if (typeof cookies === 'object' && cookies !== null) {
      for (const [name, value] of Object.entries(cookies)) {
        try {
          receivedCookies[safeHost][name] = JSON.parse(value);
        } catch (e) {
          receivedCookies[safeHost][name] = value;
        }
      }
    } else {
      console.log('Warning: Received cookies is not an object:', cookies);
    }

    let monsterID;
    let sendingCookies = {};

    if (receivedCookies[safeHost].monsterID) {
      console.log('Retrieved monsterID for host:', receivedCookies[safeHost].monsterID);
      monsterID = receivedCookies[safeHost].monsterID;
    } else {
      console.log('No monsterID for this host. Creating new monsterID.');
      monsterID = generateMonsterID();
      console.log('New monsterID:', monsterID);
      sentIDs.push(monsterID);
      receivedCookies[safeHost].monsterID = monsterID;
    }

    sendingCookies.monsterID = monsterID;

    console.log('Sending cookies back to Marketplace:', sendingCookies);
    console.log('Current receivedCookies:', receivedCookies);
    res.json(sendingCookies);
  } catch (error) {
    console.error('Error in /update-cookies route:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

function generateMonsterID() {
  return 'monster_' + crypto.randomUUID();
}

// Add this new endpoint to get sent IDs
app.get('/sent-ids', (req, res) => {
  res.json({ sentIDs });
});

// Add this new endpoint to get received cookies
app.get('/received-cookies', (req, res) => {
  res.json(receivedCookies);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (err.type === 'entity.too.large') {
    res.status(413).send('Request Entity Too Large');
  } else {
    res.status(500).send('Internal Server Error');
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`CookieMonster server is running on ${URL}:${PORT}`);
});