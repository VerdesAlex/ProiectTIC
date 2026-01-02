const { admin } = require('../firebase/config');

const validateFirebaseToken = async (req, res, next) => {
  console.log("Auth Middleware triggered!");
  const authHeader = req.headers.authorization;

  // 1. Check if the Authorization header exists and starts with "Bearer "
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    // 2. Use Admin SDK to verify the token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // 3. Attach the user info to the request object
    // This allows subsequent routes to know WHO is making the request via req.user
    req.user = decodedToken;
    
    next(); // Move to the next function (the actual route logic)
  } catch (error) {
    console.error('Error verifying Firebase token:', error);
    return res.status(403).json({ error: 'Unauthorized: Invalid token' });
  }
};

module.exports = validateFirebaseToken;