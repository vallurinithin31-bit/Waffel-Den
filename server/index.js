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
initDatabase();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/closings', closingsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/settings', settingsRouter);

// Root health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'Waffel Den Order Management & Analytics',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend build if dist directory exists
const distPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

app.listen(PORT, () => {
  console.log(`🧇 Waffel Den Server running on http://localhost:${PORT}`);
});
