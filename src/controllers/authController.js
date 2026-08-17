const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

exports.register = async (req, res) => {
  try {
    const { name, password } = req.body;
    const email = normalizeEmail(req.body.email);
    const requestedRole = req.body.role || 'user';

    if (!name?.trim() || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }

    if (!['user', 'restaurant', 'delivery'].includes(requestedRole)) {
      return res.status(403).json({ success: false, message: 'Requested role is not allowed during public registration' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ success: false, message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({ name: name.trim(), email, password: hashedPassword, role: requestedRole });

    return res.status(201).json({ success: true, message: 'User registered successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    const user = await User.findOne({ email }).select('+password');

    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (user.isblocked) return res.status(403).json({ success: false, message: 'User is blocked' });

    const isMatch = await bcrypt.compare(password || '', user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    return res.status(200).json({ success: true, message: 'User logged in successfully', token });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
