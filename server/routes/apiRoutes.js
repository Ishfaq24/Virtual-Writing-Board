const express = require('express');
const { saveBoardAsPdf, listSavedBoards } = require('../controllers/drawingController');

const router = express.Router();

router.get('/boards', listSavedBoards);
router.post('/boards/save-pdf', saveBoardAsPdf);

module.exports = router;
