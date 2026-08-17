const Restaurant = require('../models/restaurant');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const levenshtein = (a, b) => {
  const rows = b.length + 1;
  const cols = a.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i++) matrix[i][0] = i;
  for (let j = 0; j < cols; j++) matrix[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(
            matrix[i - 1][j] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j - 1] + 1
          );
    }
  }

  return matrix[rows - 1][cols - 1];
};

const fuzzyMatch = (query, restaurant) => {
  if (!query) return true;
  const terms = [restaurant.name, restaurant.city, restaurant.address, ...(restaurant.cuisine || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const normalizedQuery = query.toLowerCase().trim();

  if (terms.includes(normalizedQuery)) return true;

  return normalizedQuery.split(/\s+/).every((word) => {
    if (word.length < 3) return terms.includes(word);

    return terms
      .split(/[^a-z0-9]+/i)
      .filter((token) => token.length >= 3)
      .some((token) => {
        const maxDistance = word.length <= 4 ? 1 : 2;
        return levenshtein(word, token) <= maxDistance;
      });
  });
};

exports.createRestaurant = async (req, res) => {
  try {
    if (req.user.role !== 'restaurant') {
      return res.status(403).json({
        success: false,
        message: 'Only restaurant owners can create restaurants'
      });
    }

    const existingRestaurant = await Restaurant.findOne({ owner: req.user._id });

    if (existingRestaurant) {
      return res.status(400).json({
        success: false,
        message: 'You already have a restaurant registered'
      });
    }

    const restaurant = await Restaurant.create({
      ...req.body,
      owner: req.user._id
    });

    return res.status(201).json({
      success: true,
      message: 'Restaurant created successfully',
      data: restaurant
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error creating restaurant',
      error: error.message
    });
  }
};

exports.getMyRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ owner: req.user._id });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "You don't have a restaurant registered"
      });
    }

    return res.status(200).json({
      success: true,
      data: restaurant
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching restaurant',
      error: error.message
    });
  }
};

exports.updateRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({ owner: req.user._id });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "You don't have a restaurant registered"
      });
    }

    if (restaurant.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this restaurant'
      });
    }

    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedRestaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Restaurant updated successfully',
      data: updatedRestaurant
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error updating restaurant',
      error: error.message
    });
  }
};

exports.getAllRestaurants = async (req, res) => {
  try {
    const { city, page = 1, limit = 10 } = req.query;
    const query = { isApproved: true };

    if (city) query.city = new RegExp(`^${escapeRegex(city)}$`, 'i');

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 10, 1), 100);

    const restaurants = await Restaurant.find(query)
      .sort({ rating: -1, popularity: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber);

    return res.status(200).json({
      success: true,
      data: restaurants
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching restaurants',
      error: error.message
    });
  }
};

exports.searchRestaurants = async (req, res) => {
  try {
    const {
      q,
      cuisine,
      rating,
      minRating,
      maxRating,
      minPrice,
      maxPrice,
      priceRange,
      maxDeliveryTime,
      isVeg,
      sort = 'rating',
      order = 'desc',
      page = 1,
      limit = 20
    } = req.query;

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const pipeline = [];

    const match = { isApproved: true };

    if (cuisine) {
      const cuisines = cuisine.split(',').map((item) => item.trim()).filter(Boolean);
      if (cuisines.length) match.cuisine = { $in: cuisines };
    }

    const minimumRating = Number(minRating ?? rating);
    const maximumRating = Number(maxRating);
    if (Number.isFinite(minimumRating)) {
      match.rating = { ...(match.rating || {}), $gte: minimumRating };
    }
    if (Number.isFinite(maximumRating)) {
      match.rating = { ...(match.rating || {}), $lte: maximumRating };
    }

    const minimumPrice = Number(minPrice);
    const maximumPrice = Number(maxPrice);
    const requestedPrice = Number(priceRange);
    if (Number.isFinite(requestedPrice)) {
      match.priceRange = requestedPrice;
    } else {
      if (Number.isFinite(minimumPrice)) match.priceRange = { ...(match.priceRange || {}), $gte: minimumPrice };
      if (Number.isFinite(maximumPrice)) match.priceRange = { ...(match.priceRange || {}), $lte: maximumPrice };
    }

    const delivery = Number(maxDeliveryTime);
    if (Number.isFinite(delivery)) match.estimatedDeliveryTime = { $lte: delivery };

    if (isVeg !== undefined) {
      const vegValue = String(isVeg).toLowerCase();
      if (['true', 'false'].includes(vegValue)) match.isVegOnly = vegValue === 'true';
    }

    if (q) {
      const fuzzyRegex = new RegExp(escapeRegex(String(q).trim()), 'i');
      match.$or = [
        { name: fuzzyRegex },
        { city: fuzzyRegex },
        { address: fuzzyRegex },
        { cuisine: fuzzyRegex }
      ];
    }

    pipeline.push({ $match: match });
    pipeline.push({
      $addFields: {
        relevanceScore: {
          $add: [
            { $multiply: ['$rating', 20] },
            { $multiply: ['$popularity', 0.1] },
            { $cond: [{ $eq: ['$isVegOnly', true] }, 2, 0] }
          ]
        }
      }
    });

    const sortField = ['rating', 'priceRange', 'estimatedDeliveryTime', 'popularity', 'relevanceScore'].includes(sort)
      ? sort
      : 'rating';
    const direction = order.toLowerCase() === 'asc' ? 1 : -1;

    pipeline.push({ $sort: { [sortField]: direction, popularity: -1, _id: 1 } });
    pipeline.push({ $skip: (pageNumber - 1) * limitNumber });
    pipeline.push({ $limit: limitNumber });
    pipeline.push({ $project: { relevanceScore: 0 } });

    let results = await Restaurant.aggregate(pipeline);

    // Regex handles partial matches; this fallback adds bounded typo tolerance.
    if (q && results.length === 0) {
      const candidates = await Restaurant.find({ isApproved: true }).lean();
      results = candidates
        .filter((restaurant) => fuzzyMatch(String(q), restaurant))
        .sort((a, b) => {
          const fieldA = Number(a[sortField] ?? 0);
          const fieldB = Number(b[sortField] ?? 0);
          if (fieldA !== fieldB) return direction * (fieldA - fieldB);
          return (b.popularity || 0) - (a.popularity || 0);
        })
        .slice((pageNumber - 1) * limitNumber, pageNumber * limitNumber);
    }

    return res.status(200).json({
      success: true,
      filters: req.query,
      count: results.length,
      data: results
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error searching restaurants',
      error: error.message
    });
  }
};
