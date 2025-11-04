import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import http from 'http';
import emailRoutes from './routes/emailRoutes';
// Ensure account routes exist; in dummy mode we provide simple routes
import accountRoutes from './routes/accountRoutes';
import { initializeElasticsearch } from './services/elasticsearchService';
import { startImapSync } from './services/imapService';
import { errorHandler } from './middleware/errorHandler';
import { isDummyMode, logStartupMode } from './config/runtime';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: 'http://localhost:5173' }
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/emails', emailRoutes);
app.use('/api/accounts', accountRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Error handling
app.use(errorHandler);

// Socket.IO for real-time updates
export { io };

// Startup
logStartupMode();

const PORT = process.env.PORT || 5000;

if (isDummyMode) {
	// Start without external services
	server.listen(PORT, () => {
		console.log(`🚀 Server running on port ${PORT}`);
		console.log('🧪 Dummy mode: skipping MongoDB, Elasticsearch, and IMAP');
	});
} else {
	// Database connection
	mongoose.connect(process.env.MONGODB_URI!)
		.then(async () => {
			console.log('✅ MongoDB connected');

			// Initialize Elasticsearch
			await initializeElasticsearch();
			console.log('✅ Elasticsearch initialized');

			// Start IMAP sync for all accounts
			await startImapSync();
			console.log('✅ IMAP sync started');

			// Start server
			server.listen(PORT, () => {
				console.log(`🚀 Server running on port ${PORT}`);
				console.log(`📧 Email aggregator ready!`);
			});
		})
		.catch(err => {
			console.error('❌ Database connection error:', err);
			process.exit(1);
		});
}