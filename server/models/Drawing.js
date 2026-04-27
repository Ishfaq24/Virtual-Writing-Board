const mongoose = require('mongoose');

const drawingSchema = new mongoose.Schema(
	{
		owner: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true,
			index: true,
		},
		title: {
			type: String,
			trim: true,
			maxlength: 120,
			default: 'Untitled Board',
		},
		aiMode: {
			type: String,
			enum: ['word', 'phrase', 'math', 'unknown'],
			default: 'unknown',
		},
		recentWords: {
			type: [String],
			default: [],
		},
		fileName: {
			type: String,
			required: true,
		},
		filePath: {
			type: String,
			required: true,
		},
		fileUrl: {
			type: String,
			required: true,
		},
		sizeBytes: {
			type: Number,
			required: true,
			min: 1,
		},
	},
	{
		timestamps: true,
	},
);

module.exports = mongoose.model('Drawing', drawingSchema);
