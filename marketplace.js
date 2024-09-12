const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const cors = require('cors');

const app = express();
const URL = 'http://marketplace.local';
const PORT = 3000;
const COOKIE_MONSTER_URL = 'http://cookiemonster.local:3001';

// Use cookie-parser middleware
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(cors({
  origin: COOKIE_MONSTER_URL,
  credentials: true
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Custom proxy middleware
const cookieMonsterForward = async (req, res, next) => {
  console.log('Entering cookieMonsterForward');
  try {
    console.log('Preparing to forward request to CookieMonster');
    console.log('Original request path:', req.path);
    console.log('Cookies:', req.cookies);

    const forwardUrl = `${COOKIE_MONSTER_URL}/update-cookies`;
    console.log('Forwarding to URL:', forwardUrl);

    // Prepare cookies object
    const cookies = req.cookies;
    console.log('Coooooooooookies:', cookies);

    const axiosConfig = {
      method: req.method,
      url: forwardUrl,
      headers: {
        ...req.headers,
        'Content-Type': 'application/json',
        host: COOKIE_MONSTER_URL.replace(/^https?:\/\//, ''), // Remove protocol from URL
      },
      data: {
        cookies: JSON.stringify(cookies),
        originalBody: req.body,
      },
      validateStatus: false, // Allow any status code
    };

    const response = await axios(axiosConfig);

    console.log('Received response from CookieMonster');

    // Store the response data and headers to be used later
    res.locals.cookieMonsterResponse = {
      status: response.status,
      headers: response.headers,
      data: response.data
    };

    next();
  } catch (error) {
    console.error('Error in cookieMonsterForward:', error);
    next(error);
  }
};

// Middleware to handle POST requests
app.use((req, res, next) => {
  if (req.method === 'POST') {
    console.log('Intercepted POST request:', req.path);
    express.raw({ type: '*/*', limit: '1mb' })(req, res, (err) => {
      if (err) return next(err);
      try {
        req.body = JSON.parse(req.body.toString());
      } catch (error) {
        console.error('Error parsing request body:', error);
        console.error('Raw body:', req.body.toString());
        req.body = {};
      }
      cookieMonsterForward(req, res, next);
    });
  } else {
    next();
  }
});

// Add to cart functionality
app.post('/add-to-cart', express.json(), (req, res) => {
  console.log('Received add-to-cart request');
  console.log('Request body:', req.body);
  const { product, price } = req.body;
  console.log('Product:', product, 'Price:', price);

  try {
    let cart = req.cookies.cart ? JSON.parse(req.cookies.cart) : [];
    cart.push({ product, price });

    res.cookie('cart', JSON.stringify(cart), {
      maxAge: 900000,
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });

    console.log('Updated cart cookie:', cart);

    // Check if cookieMonsterForward has already processed the request
    if (res.locals.cookieMonsterResponse) {
      const { status, headers, data } = res.locals.cookieMonsterResponse;
      res.status(status).set(headers).send(data);
    } else {
      res.json({ success: true, cart });
    }
  } catch (error) {
    console.error('Error in /add-to-cart route handler:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Get cart items
app.get('/cart', (req, res) => {
  try {
    const cart = req.cookies.cart ? JSON.parse(req.cookies.cart) : [];
    const totalSum = cart.reduce((sum, item) => sum + parseFloat(item.price), 0);
    console.log('Retrieved cart:', cart);
    res.json({ items: cart, totalSum });
  } catch (error) {
    console.error('Error in /cart route handler:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Remove item from cart
app.delete('/cart/:index', (req, res) => {
  try {
    const index = parseInt(req.params.index);
    let cart = req.cookies.cart ? JSON.parse(req.cookies.cart) : [];

    if (index >= 0 && index < cart.length) {
      cart.splice(index, 1);
      res.cookie('cart', JSON.stringify(cart), { 
        maxAge: 900000,
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
      });
      console.log('Item removed from cart. Updated cart:', cart);
      res.json({ success: true, message: 'Item removed from cart', cart });
    } else {
      res.status(400).json({ success: false, message: 'Invalid item index' });
    }
  } catch (error) {
    console.error('Error in /cart/:index DELETE route handler:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).send('Internal Server Error');
});

// Serve marketplace.html as the default page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'marketplace.html'));
});

// Test route to check if server is responsive
app.get('/test', (req, res) => {
  res.json({ message: 'Server is working' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Marketplace server is running on ${URL}:${PORT}`);
});