# Fraud Detection and Order Validation

## Detection rules

The fraud engine assigns a risk score when an order is created, cancelled, or a refund is requested.

| Rule | Score |
|---|---:|
| 3 or more orders within 10 minutes | +40 |
| 2 or more cancellations within 24 hours | +25 |
| 4 or more uses of the same coupon within 24 hours | +20 |
| 3 or more refund requests within 7 days | +30 |

An order is flagged when its score reaches **50** or more.

## Order endpoints

- `POST /api/orders/create` - create and assess an order
- `POST /api/orders/cancel/:orderId` - cancel an order and reassess risk
- `POST /api/orders/refund/:orderId` - submit a refund request and reassess risk
- `POST /api/orders/verify` - mock payment; suspicious orders must be reviewed first

## Admin fraud endpoints

All require an admin Bearer token.

- `GET /api/admin/fraud/orders` - list pending fraud reviews
- `PUT /api/admin/fraud/orders/:orderId/approve` - approve a flagged order
- `PUT /api/admin/fraud/orders/:orderId/reject` - reject and cancel a flagged order
- `PUT /api/admin/fraud/orders/:orderId/restrict-user` - temporarily restrict the user (`hours` in the JSON body, default 24, maximum 168)

## Report credential handling

The project report should include the administrator login credentials supplied by the project owner/evaluator. **Do not commit real administrator passwords to this repository.** Store deployment credentials in Render environment variables or another secret-management mechanism, and place the actual credentials only in the private report distributed to authorized evaluators.
