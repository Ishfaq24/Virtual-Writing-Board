const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const MIN_PASSWORD_LENGTH = 6;

function normalizeEmail(email) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function buildToken(user) {
    const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
    return jwt.sign(
        {
            sub: user._id.toString(),
            email: user.email,
            name: user.name,
        },
        secret,
        { expiresIn: '7d' },
    );
}

function sanitizeUser(user) {
    return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
    };
}

async function signUp(req, res) {
    const { name, email, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    const normalizedName = typeof name === 'string' ? name.trim() : '';

    if (!normalizedName || !normalizedEmail || typeof password !== 'string') {
        return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }

    try {
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(409).json({ message: 'Email is already registered.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await User.create({
            name: normalizedName,
            email: normalizedEmail,
            passwordHash,
        });

        const token = buildToken(user);
        return res.status(201).json({
            token,
            user: sanitizeUser(user),
        });
    } catch (error) {
        console.error('[AUTH SIGNUP ERROR]', error);
        return res.status(500).json({ message: 'Failed to create account.' });
    }
}

async function signIn(req, res) {
    const { email, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || typeof password !== 'string') {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const token = buildToken(user);
        return res.json({
            token,
            user: sanitizeUser(user),
        });
    } catch (error) {
        console.error('[AUTH SIGNIN ERROR]', error);
        return res.status(500).json({ message: 'Failed to sign in.' });
    }
}

function signOut(_req, res) {
    return res.json({ message: 'Signed out.' });
}

function me(req, res) {
    return res.json({ user: req.user });
}

module.exports = {
    signUp,
    signIn,
    signOut,
    me,
};
