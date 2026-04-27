const mongoose = require('mongoose');

const DEFAULT_MONGO_URI = 'mongodb://127.0.0.1:27017/virtual_whiteboard';

async function connectDatabase() {
	const mongoUri = process.env.MONGO_URI || DEFAULT_MONGO_URI;

	try {
		await mongoose.connect(mongoUri, {
			serverSelectionTimeoutMS: 5000,
		});
		console.log(`[DB] MongoDB connected: ${mongoUri}`);
	} catch (error) {
		console.error('[DB] MongoDB connection failed:', error.message || error);
	}
}

module.exports = connectDatabase;
