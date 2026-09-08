const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Import rateLimit
if (!content.includes('express-rate-limit')) {
  content = content.replace(
    "import express from 'express';",
    "import express from 'express';\nimport rateLimit from 'express-rate-limit';"
  );
}

// Add Rate Limiters after app.use(express.json());
const limitersCode = `

// --- SECURITY: Rate Limiting OWASP (Throttling) ---
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 300, // Limit each IP to 300 requests per windowMs for general API
  message: { error: 'API rate limit exceeded. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const sensitiveActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Strict limit for sensitive actions like trading or saving config
  message: { error: 'Too many sensitive requests. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply global rate limiter to all routes
app.use(globalLimiter);

// Apply API-specific limiter to /api/ routes
app.use('/api/', apiLimiter);

// Apply strict limiter to sensitive routes
app.use('/api/config/binance', sensitiveActionLimiter);
app.use('/api/binance/order', sensitiveActionLimiter);
`;

if (!content.includes('globalLimiter')) {
  content = content.replace(
    'app.use(express.json());',
    'app.use(express.json());' + limitersCode
  );
}

fs.writeFileSync('server.ts', content, 'utf8');
console.log('Added rate limiters to server.ts');
