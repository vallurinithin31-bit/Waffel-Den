import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { initDatabase } from './db.js';
import productsRouter from './routes/products.js';
import ordersRouter from './routes/orders.js';
import expensesRouter from './routes/expenses.js';
import inventoryRouter from './routes/inventory.js';
import closingsRouter from './routes/closings.js';
import analyticsRouter from './routes/analytics.js';
import reportsRouter from './routes/reports.js';
import settingsRouter from './routes/settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB schema & seed data
try {
  initDatabase();
} catch (dbErr) {
  console.error('Database initialization notice:', dbErr);
}

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Normalize URL for Vercel rewrites: if Vercel mapped to /api/index.js, restore from x-matched-path
app.use((req, res, next) => {
  if (req.url.startsWith('/api/index.js') || req.url.startsWith('/api/index')) {
    const original = req.headers['x-matched-path'] || req.headers['x-now-route-matches'];
    if (original && !original.includes('index.js')) {
      req.url = original;
    }
  }
  next();
});

// Helper to mount routes both with and without '/api' prefix (handles Vercel serverless url variations)
const mount = (routePath, router) => {
  app.use(`/api/${routePath}`, router);
  app.use(`/${routePath}`, router);
};

// API Routes
mount('products', productsRouter);
mount('orders', ordersRouter);
mount('expenses', expensesRouter);
mount('inventory', inventoryRouter);
mount('closings', closingsRouter);
mount('analytics', analyticsRouter);
mount('reports', reportsRouter);
mount('settings', settingsRouter);

// Health check
app.get(['/api/health', '/health'], (req, res) => {
  res.json({
    status: 'online',
    app: 'Waffel Den Order Management & Analytics',
    version: '1.0.0',
    platform: process.env.VERCEL ? 'vercel-serverless' : 'node-server',
    timestamp: new Date().toISOString()
  });
});

// Root API info endpoint
app.get(['/api', '/api/'], (req, res) => {
  res.json({
    status: 'online',
    app: 'Waffel Den API',
    endpoints: [
      '/api/products',
      '/api/products/categories',
      '/api/orders',
      '/api/orders/next-number',
      '/api/expenses',
      '/api/inventory',
      '/api/closings',
      '/api/analytics',
      '/api/reports',
      '/api/settings',
      '/api/health'
    ]
  });
});

// Serve frontend build if dist directory exists and not on Vercel
const distPath = path.join(__dirname, '..', 'dist');
if (!process.env.VERCEL && fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

export default app;
