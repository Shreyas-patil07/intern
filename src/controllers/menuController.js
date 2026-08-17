const Menu = require('../models/Menu');
const Restaurant = require('../models/restaurant');

exports.addMenuItem = async (req, res) => {
  try {
    if (req.user.role !== 'restaurant') return res.status(403).json({ success: false, message: 'Only restaurant owners can add menu items' });
    const restaurant = await Restaurant.findOne({ owner: req.user._id });
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });
    if (!restaurant.isApproved) return res.status(403).json({ success: false, message: 'Restaurant not approved yet' });
    const menuItem = await Menu.create({ ...req.body, restaurant: restaurant._id });
    return res.status(201).json({ success: true, message: 'Menu item added successfully', data: menuItem });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error adding menu item', error: error.message });
  }
};

exports.getMyMenu = async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ owner: req.user._id });
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });
    const menu = await Menu.find({ restaurant: restaurant._id });
    return res.status(200).json({ success: true, data: menu });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching menu', error: error.message });
  }
};

exports.updateMenuItem = async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ owner: req.user._id });
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });
    const menuItem = await Menu.findOne({ _id: req.params.id, restaurant: restaurant._id });
    if (!menuItem) return res.status(404).json({ success: false, message: 'Menu item not found' });
    Object.assign(menuItem, req.body);
    await menuItem.save();
    return res.status(200).json({ success: true, message: 'Menu item updated successfully', data: menuItem });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error updating menu item', error: error.message });
  }
};

exports.deleteMenuItem = async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ owner: req.user._id });
    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });
    const menuItem = await Menu.findOneAndDelete({ _id: req.params.id, restaurant: restaurant._id });
    if (!menuItem) return res.status(404).json({ success: false, message: 'Menu item not found' });
    return res.status(200).json({ success: true, message: 'Menu item deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error deleting menu item', error: error.message });
  }
};
