# Swiggy Backend API

A RESTful food-delivery backend built with **Node.js, Express, MongoDB, Mongoose, JWT, bcrypt, and Socket.IO**. The project provides the core backend services for a Swiggy-style platform, including users, restaurants, menus, carts, orders, delivery partners, administration, fraud detection, personalized recommendations, and real-time order notifications.

> **Live API:** https://intern-swiggy.onrender.com

## Features

- **Authentication & Authorization** – JWT-based authentication with role-based access for customers, restaurants, delivery partners, and admins.
- **Restaurant Management** – Create, update, approve, search, and list restaurants.
- **Menu Management** – Restaurant menu creation and management.
- **Cart & Ordering** – Add/remove cart items and create, update, cancel, and refund orders.
- **Order Tracking** – Status lifecycle from `pending` → `confirmed` → `preparing` → `out_for_delivery` → `delivered`.
- **Delivery Management** – Delivery partner availability, assignments, status updates, and order decline handling.
- **Real-Time Notifications** – Socket.IO events for order-status updates, plus persistent notification records.
- **Personalized Recommendations** – Builds user preference profiles from order history and ranks restaurants using cuisine matches, item matches, ratings, and popularity.
- **Fraud Detection** – Risk scoring for rapid orders, cancellations, repeated coupon usage, and refund requests. Suspicious orders can be reviewed by administrators.
- **Admin Dashboard APIs** – User management, restaurant approval, order statistics, fraud review, surge settings, and delivery partner management.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express 5 |
| Database | MongoDB + Mongoose |
| Authentication | JWT |
| Password Hashing | bcrypt |
| Real-Time Communication | Socket.IO |
| Middleware | CORS, dotenv |
| Development | Nodemon |
| Deployment | Render |

## Project Structure

```text
intern/
├── docs/
│   ├── FRAUD_DETECTION.md
│   └── REALTIME_ORDER_STATUS.md
├── src/
│   ├── config/          # Database configuration
│   ├── controllers/     # Business logic
│   ├── middleware/      # Authentication and authorization
│   ├── models/          # Mongoose models
│   ├── routes/          # REST API routes
│   ├── services/        # Recommendation and real-time services
│   └── app.js            # Express application
├── .env.example
├── package.json
├── server.js
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB / MongoDB Atlas
- npm

### Installation

```bash
git clone https://github.com/Shreyas-patil07/intern.git
cd intern
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
JWT_SECRET=replace_with_a_long_random_secret
```

Never commit real credentials or secrets to the repository.

### Run the Server

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

The API runs by default at:

```text
http://localhost:5000
```

Health check:

```text
GET /health
```

## API Overview

### Authentication

```text
/api/auth
```

Handles user registration, login, and authentication-related operations.

### Restaurants

```text
GET    /api/restaurants
GET    /api/restaurants/search
GET    /api/restaurants/recommendations/:userId
POST   /api/restaurants
GET    /api/restaurants/my
PUT    /api/restaurants/:id
```

### Menu

```text
/api/menu
```

Provides restaurant menu operations.

### Cart

```text
/api/cart
```

Handles shopping cart operations for users.

### Orders

```text
/api/orders
```

Supports order creation, retrieval, cancellation, refund requests, payment verification, and status updates.

### Delivery

```text
/api/delivery
```

Restricted to delivery partners for availability, assignments, status updates, and declining assigned orders.

### Notifications

```text
/api/notifications
```

Provides persistent notification retrieval and read-status management.

### Admin

```text
/api/admin
```

Admin-only APIs for users, restaurants, orders, statistics, fraud reviews, surge settings, and delivery partners.

## Personalized Recommendation Engine

The recommendation service updates a user's preference profile after orders are placed. It tracks frequently ordered cuisines and menu items, then calculates a restaurant recommendation score using:

- Cuisine matches
- Menu-item matches
- Restaurant rating
- Restaurant popularity

For users without a preference history, the system falls back to approved restaurants sorted by rating and popularity.

## Fraud Detection

Orders are assigned a risk score using configurable behavioral rules. The current detection rules include:

| Rule | Score |
|---|---:|
| 3+ orders within 10 minutes | +40 |
| 2+ cancellations within 24 hours | +25 |
| 4+ uses of the same coupon within 24 hours | +20 |
| 3+ refund requests within 7 days | +30 |

Orders with a score of **50 or higher** are flagged for review. Administrators can approve, reject, or temporarily restrict users associated with suspicious activity.

See [`docs/FRAUD_DETECTION.md`](docs/FRAUD_DETECTION.md) for details.

## Real-Time Order Updates

Socket.IO is initialized on the same HTTP server as the REST API. Order status changes generate persistent notifications and real-time `order-status-updated` events.

Example client connection:

```javascript
const socket = io('http://localhost:5000', {
  auth: { userId: '<USER_ID>' }
});

socket.on('order-status-updated', (payload) => {
  console.log(payload);
});
```

See [`docs/REALTIME_ORDER_STATUS.md`](docs/REALTIME_ORDER_STATUS.md) for the complete status lifecycle and integration details.

## Security

- JWT authentication for protected endpoints
- Role-based authorization for admin, restaurant, and delivery operations
- bcrypt password hashing
- Environment variables for secrets and database credentials
- Sensitive administrator credentials are intentionally excluded from the repository

## Deployment

The backend is deployed on **Render** and uses MongoDB as its persistent database. Configure the same environment variables shown in `.env.example` in the deployment environment.

## Development Scripts

```bash
npm run dev   # Start with Nodemon
npm start     # Start production server
```

## Repository

[GitHub Repository](https://github.com/Shreyas-patil07/intern)

## Documentation

- [Fraud Detection](docs/FRAUD_DETECTION.md)
- [Real-Time Order Status](docs/REALTIME_ORDER_STATUS.md)
