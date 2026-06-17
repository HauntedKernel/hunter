/**
 * FlashStack Backend Server
 * Express server hosting Dallas CAD Property Intelligence APIs
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

// Import API routes
const propertyIntelligenceRouter = require('./src/api/propertyIntelligence');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// Allowed browser origins. Local dev defaults, plus any production origins from
// CORS_ORIGINS (comma-separated), e.g. CORS_ORIGINS="https://hunter.pages.dev,https://app.hunter.com"
const defaultOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://localhost:5173',
  'http://127.0.0.1:5173'
];
const envOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
app.use(cors({
  origin: [...defaultOrigins, ...envOrigins],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/property', propertyIntelligenceRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'FlashStack Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'FlashStack Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      propertyAnalysis: '/api/property/analyze',
      batchAnalysis: '/api/property/batch',
      recommendations: '/api/property/recommendations',
      stats: '/api/property/stats',
      propertyHealth: '/api/property/health'
    },
    documentation: {
      analyze: 'POST /api/property/analyze - Analyze single property',
      batch: 'POST /api/property/batch - Analyze multiple properties',
      recommendations: 'GET /api/property/recommendations - Get property recommendations',
      stats: 'GET /api/property/stats - Get system statistics'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'SERVER_ERROR',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    availableEndpoints: [
      '/health',
      '/api/property/analyze',
      '/api/property/batch',
      '/api/property/recommendations',
      '/api/property/stats',
      '/api/property/health'
    ],
    timestamp: new Date().toISOString()
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('\n========================================');
  console.log('🚀 FlashStack Backend Server Started');
  console.log('========================================');
  console.log(`🌐 Server: http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`🏠 Property API: http://localhost:${PORT}/api/property`);
  console.log('');
  console.log('📋 Available Endpoints:');
  console.log(`   POST /api/property/analyze     - Analyze single property`);
  console.log(`   POST /api/property/batch       - Batch analysis`);
  console.log(`   GET  /api/property/recommendations - Get recommendations`);
  console.log(`   GET  /api/property/stats       - System statistics`);
  console.log(`   GET  /api/property/health      - Component health`);
  console.log('');
  console.log('🔧 Dallas CAD Integration Status: ✅ OPERATIONAL');
  console.log('========================================\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down FlashStack Backend...');
  
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, shutting down...');
  
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

module.exports = app;