# Transaction Guide

This guide explains how subscription transactions work in the Caskayd backend and how to complete them through Swagger.

## Purpose

Use this flow when a user wants to:

- start a paid subscription
- complete payment on Flutterwave
- activate the subscription in the Caskayd database
- confirm the subscription is active
- cancel auto-renew later

## Important Notes

- Subscription endpoints require a valid JWT access token.
- Creating a payment is not the same as activating a subscription.
- A subscription becomes active only after payment is completed and the verify endpoint is called.
- Currency is `NGN`.
- The payment flow currently uses card payments through Flutterwave.

## Local Swagger URL

- `http://localhost:3000/docs`

## API Base URL

- `http://localhost:3000/api`

## Environment Requirements

Make sure these values are configured in `.env` before testing transactions:

```env
FLUTTERWAVE_SECRET_KEY=
FLUTTERWAVE_BASE_URL=https://api.flutterwave.com/v3
FLUTTERWAVE_REDIRECT_URL=
FLUTTERWAVE_WEBHOOK_SECRET_HASH=
```

If `FLUTTERWAVE_SECRET_KEY` or `FLUTTERWAVE_REDIRECT_URL` is missing, transaction initialization will fail.

## Subscription Plans

Current plans:

- `INDIVIDUAL` = `7500 NGN` per 30 days
- `TEAM` = `25000 NGN` per 30 days

## End-to-End Transaction Flow

### 1. Register or log in

In Swagger:

1. Open the `Auth` section.
2. Use `POST /auth/register` if the user does not have an account yet.
3. Use `POST /auth/login` to log in.
4. Copy the returned access token.
5. Click `Authorize` in Swagger and paste the bearer token.

Example login body:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

## 2. Check available plans

Use `GET /subscriptions`.

This returns the valid plan names the backend accepts.

Expected plan values:

- `INDIVIDUAL`
- `TEAM`

## 3. Initialize the transaction

Use `POST /subscriptions/initialize`.

Example body:

```json
{
  "plan": "INDIVIDUAL"
}
```

Expected response shape:

```json
{
  "subscriptionId": "cm...",
  "paymentLink": "https://checkout.flutterwave.com/...",
  "reference": "caskayd-userId-timestamp"
}
```

What this step does:

- creates a local subscription record with status `PENDING`
- prepares or reuses a monthly Flutterwave payment plan
- generates a Flutterwave checkout link

Important:

- save the `subscriptionId`
- save the `reference`
- open the returned `paymentLink`

## 4. Complete payment on Flutterwave

Open the `paymentLink` from the initialize response in a browser.

The user must complete the payment successfully on Flutterwave.

This project sends:

- the user email
- the user full name
- the transaction reference
- the selected plan amount
- the configured redirect URL

## 5. Get the Flutterwave transaction ID

After successful payment, get the Flutterwave transaction ID from the Flutterwave success page, dashboard, or callback flow.

This is the value required by the verify endpoint.

## 6. Verify the transaction

Use `POST /subscriptions/verify`.

Example body:

```json
{
  "transactionId": "123456789"
}
```

What verify does:

- confirms the transaction with Flutterwave
- finds the matching local pending subscription using the Flutterwave reference
- checks that a recurring subscription was actually created on Flutterwave
- marks the local subscription as `ACTIVE`
- enables `autoRenew`
- sets `expiresAt`
- expires any older active subscription for the same user

If verification succeeds, the response will be the updated subscription record.

## 7. Confirm the subscription is active

Use `GET /subscriptions/me`.

You should see a subscription record like this:

```json
{
  "id": "cm...",
  "userId": "cm...",
  "plan": "INDIVIDUAL",
  "status": "ACTIVE",
  "autoRenew": true,
  "flutterwaveTransactionId": "123456789",
  "flutterwaveReference": "caskayd-userId-timestamp",
  "flutterwaveSubscriptionId": 12345,
  "flutterwavePaymentPlanId": 67890,
  "expiresAt": "2026-09-12T12:00:00.000Z"
}
```

## 8. Cancel auto-renew

Use `POST /subscriptions/cancel`.

This does not immediately remove access if the subscription is still within its paid period.

It:

- cancels the recurring Flutterwave subscription
- sets `autoRenew` to `false`
- fills `cancelledAt`

## Common Errors and What They Mean

### 401 Unauthorized

Cause:

- the access token was not added in Swagger
- the token is invalid or expired

Fix:

- log in again
- click `Authorize`
- paste a valid bearer token

### Payment initialization fails

Possible causes:

- `FLUTTERWAVE_SECRET_KEY` is missing
- `FLUTTERWAVE_REDIRECT_URL` is missing
- Flutterwave API is unreachable

### Verification fails with "Payment verification failed"

Cause:

- the transaction was not successful on Flutterwave
- the transaction ID is wrong

Fix:

- confirm the payment succeeded
- confirm the exact Flutterwave transaction ID

### Verification fails with "Subscription record not found"

Cause:

- the transaction reference could not be matched to a local initialized subscription

Fix:

- make sure `POST /subscriptions/initialize` was called first
- verify the payment belongs to the same logged-in user

### Verification fails with "Recurring subscription was not created on Flutterwave"

Cause:

- Flutterwave completed the payment, but no recurring subscription record was created

Fix:

- confirm the payment was made through the subscription flow
- check Flutterwave dashboard records

### Cancel fails with "Active subscription not found"

Cause:

- the user does not currently have an active subscription

### Cancel fails with "Subscription is not currently set to auto-renew"

Cause:

- the subscription is already cancelled
- no remote recurring subscription exists to cancel

## Quick Swagger Checklist

1. `POST /auth/login`
2. Click `Authorize`
3. `GET /subscriptions`
4. `POST /subscriptions/initialize`
5. Open `paymentLink`
6. Complete payment
7. Copy Flutterwave transaction ID
8. `POST /subscriptions/verify`
9. `GET /subscriptions/me`
10. Optional: `POST /subscriptions/cancel`

## Example Test Flow

### Initialize

```json
{
  "plan": "TEAM"
}
```

### Verify

```json
{
  "transactionId": "987654321"
}
```

## Developer Notes

- The backend creates a local `PENDING` subscription before redirecting to Flutterwave.
- Verification is required to activate the subscription locally.
- Webhooks support recurring charge sync and cancellation sync, but initial activation still depends on calling the verify endpoint in the current flow.
