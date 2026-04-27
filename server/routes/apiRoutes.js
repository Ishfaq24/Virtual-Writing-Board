const express = require('express');
const { signUp, signIn, signOut, me } = require('../controllers/authController');
const { saveBoardAsPdf, listSavedBoards } = require('../controllers/drawingController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/auth/signup', signUp);
router.post('/auth/signin', signIn);
router.post('/auth/signout', signOut);
router.get('/auth/me', requireAuth, me);

router.get('/boards', requireAuth, listSavedBoards);
router.post('/boards/save-pdf', requireAuth, saveBoardAsPdf);

module.exports = router;
