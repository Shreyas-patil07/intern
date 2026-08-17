const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const restaurantRoutes = require('./routes/restaurantRoute');
const menuRoutes = require('./routes/menuRoute');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/AdminRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Swiggy API'
  });
});

module.exports = app;
