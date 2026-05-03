const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const { PDFDocument } = require('pdf-lib');
const Drawing = require('../models/Drawing');

const STORAGE_DIR = path.join(__dirname, '..', 'storage', 'boards');

const SUPPORTED_IMAGE_PREFIXES = {
	'data:image/png;base64,': 'png',
	'data:image/jpeg;base64,': 'jpeg',
	'data:image/jpg;base64,': 'jpeg',
};

function sanitizeTitle(rawTitle) {
	if (typeof rawTitle !== 'string') return 'Untitled Board';

	const trimmed = rawTitle.trim();
	if (!trimmed) return 'Untitled Board';

	return trimmed.slice(0, 120);
}

function parseBase64Image(imageDataUrl) {
	if (typeof imageDataUrl !== 'string') return null;

	const prefix = Object.keys(SUPPORTED_IMAGE_PREFIXES).find((item) => imageDataUrl.startsWith(item));
	if (!prefix) return null;

	const mimeType = `image/${SUPPORTED_IMAGE_PREFIXES[prefix]}`;
	const base64Payload = imageDataUrl.slice(prefix.length);
	if (!base64Payload) return null;

	return {
		mimeType,
		extension: SUPPORTED_IMAGE_PREFIXES[prefix] === 'jpeg' ? 'jpg' : 'png',
		buffer: Buffer.from(base64Payload, 'base64'),
	};
}

async function ensureStorageDirectory() {
	await fs.mkdir(STORAGE_DIR, { recursive: true });
}

async function saveBoardAsPdf(req, res) {
	if (mongoose.connection.readyState !== 1) {
		return res.status(503).json({
			message: 'Database is not connected. Start MongoDB and retry.',
		});
	}

	const { imageDataUrl, title, aiMode, recentWords } = req.body || {};
	const parsedImage = parseBase64Image(imageDataUrl);

	if (!parsedImage) {
		return res.status(400).json({
			message: 'Invalid image payload. Use a PNG or JPG data URL.',
		});
	}

	if (parsedImage.buffer.length > 8 * 1024 * 1024) {
		return res.status(413).json({
			message: 'Image payload is too large. Keep it below 8MB.',
		});
	}

	try {
		await ensureStorageDirectory();

		const pdfDoc = await PDFDocument.create();
		const embeddedImage = parsedImage.extension === 'png'
			? await pdfDoc.embedPng(parsedImage.buffer)
			: await pdfDoc.embedJpg(parsedImage.buffer);

		const width = embeddedImage.width;
		const height = embeddedImage.height;
		const page = pdfDoc.addPage([width, height]);
		page.drawImage(embeddedImage, {
			x: 0,
			y: 0,
			width,
			height,
		});

		const pdfBytes = await pdfDoc.save();
		const timeStamp = Date.now();
		const fileName = `board-${timeStamp}-${Math.random().toString(16).slice(2, 8)}.pdf`;
		const absolutePath = path.join(STORAGE_DIR, fileName);

		await fs.writeFile(absolutePath, pdfBytes);

		const storedBoard = await Drawing.create({
			owner: req.user.id,
			title: sanitizeTitle(title),
			aiMode: ['word', 'phrase', 'math'].includes(aiMode) ? aiMode : 'unknown',
			recentWords: Array.isArray(recentWords)
				? recentWords.filter((item) => typeof item === 'string').slice(0, 10)
				: [],
			fileName,
			filePath: absolutePath,
			fileUrl: `/storage/boards/${fileName}`,
			sizeBytes: pdfBytes.length,
		});

		return res.status(201).json({
			message: 'Board saved as PDF.',
			board: storedBoard,
		});
	} catch (error) {
		console.error('[PDF SAVE ERROR]', error);
		return res.status(500).json({
			message: 'Failed to save board PDF.',
			error: error.message || 'Unknown server error',
		});
	}
}

async function listSavedBoards(_req, res) {
	if (mongoose.connection.readyState !== 1) {
		return res.status(503).json({
			message: 'Database is not connected. Start MongoDB and retry.',
		});
	}

	try {
		const boards = await Drawing.find({ owner: req.user.id })
			.sort({ createdAt: -1 })
			.limit(30)
			.lean();

		return res.json({ boards });
	} catch (error) {
		console.error('[BOARD LIST ERROR]', error);
		return res.status(500).json({
			message: 'Failed to load saved boards.',
			error: error.message || 'Unknown server error',
		});
	}
}

module.exports = {
	saveBoardAsPdf,
	listSavedBoards,
};
