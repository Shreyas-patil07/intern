const Cart = require('../models/Cart');
const Menu = require('../models/Menu');

exports.addToCart = async (req, res) => {
  try {
    const { menuItemId, quantity } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be greater than 0' });
    }

    const menuItem = await Menu.findById(menuItemId).populate('restaurant');

    if (!menuItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
      cart = await Cart.create({
        user: req.user._id,
        restaurant: menuItem.restaurant._id,
        items: [{ menuItem: menuItem._id, quantity }]
      });
    } else {
      if (cart.restaurant.toString() !== menuItem.restaurant._id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'You can only add items from one restaurant to the cart'
        });
      }

      const existingItem = cart.items.find(
        item => item.menuItem.toString() === menuItemId.toString()
      );

      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        cart.items.push({ menuItem: menuItem._id, quantity });
      }
    }

    await cart.populate('items.menuItem');
    cart.totalAmount = cart.items.reduce(
      (total, item) => total + item.menuItem.price * item.quantity,
      0
    );

    await cart.save();

    return res.status(200).json({
      success: true,
      message: 'Item added to cart',
      data: cart
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error adding item to cart',
      error: error.message
    });
  }
};
