# Real-Time Order Status and Notifications

## Order status lifecycle

`pending` → `confirmed` → `preparing` → `out_for_delivery` → `delivered`

`cancelled` is available from the user/restaurant/admin rules where applicable.

## Status API

```http
PUT /api/orders/update-status/:orderId
Authorization: Bearer <JWT>
Content-Type: application/json
```

```json
{
  "status": "preparing"
}
```

Permissions:
- `restaurant`: `confirmed`, `preparing`, `cancelled` for its own restaurant orders.
- assigned `delivery`: `out_for_delivery`, `delivered`.
- `admin`: any valid status.

## Order details

```http
GET /api/orders/:orderId
Authorization: Bearer <JWT>
```

The order response includes `statusHistory` and the assigned delivery partner.

## Notifications

Socket.IO is enabled on the same server.

Client connection example:

```js
const socket = io('http://localhost:5000', {
  auth: { userId: '<USER_ID>' }
});

socket.on('order-status-updated', (payload) => {
  console.log(payload);
});
```

Clients can also join an order room:

```js
socket.emit('join-order', '<ORDER_ID>');
```

## Persistent notifications

```http
GET /api/notifications
PUT /api/notifications/:id/read
Authorization: Bearer <JWT>
```

Every order status change creates a notification document and emits `order-status-updated` to the customer's user room and the order room.
