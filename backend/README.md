# Financial Backend

This is the standalone MongoDB + Express backend for the hackathon project.

## Features

- Express API server
- MongoDB + Mongoose data layer
- Transaction CRUD and financial summary
- Centralized validation and error handling
- Health endpoint for monitoring

## Setup

1. Install dependencies:
   npm install
2. Copy `.env.example` to `.env` and set values.
3. Start the server:
   npm run dev

## MongoDB Atlas setup

1. Create a cluster in MongoDB Atlas.
2. Under **Database Access**, create a database user and save its username and password.
3. Under **Network Access**, allow the IP address of the machine running this backend.
4. In the cluster's **Connect** flow, choose **Drivers** and copy the connection string.
5. Put the connection string in `backend/.env`, replacing the placeholders below. URL-encode any reserved characters in the database username or password.

```env
MONGODB_URI=mongodb+srv://<db_username>:<db_password>@<cluster-host>/financial_backend?retryWrites=true&w=majority
DB_NAME=financial_backend
PORT=4000
```

Keep `.env` private; it contains database credentials. Do not commit it or share the URI in chat. The backend reads `MONGODB_URI` and connects through Mongoose. If it is omitted, the app uses an in-memory MongoDB for local development, which is temporary and is not an Atlas connection.

## Environment variables

```env
MONGODB_URI=mongodb+srv://<db_username>:<db_password>@<cluster-host>/financial_backend?retryWrites=true&w=majority
DB_NAME=financial_backend
PORT=4000
```

## API Endpoints

- GET /api/health
- POST /api/transactions
- GET /api/transactions
- GET /api/transactions/:id
- PUT /api/transactions/:id
- PATCH /api/transactions/:id
- DELETE /api/transactions/:id
- GET /api/transactions/summary

## Example request body

```json
{
  "userId": "USER_ID",
  "type": "expense",
  "amount": 15000,
  "currency": "NGN",
  "category": "inventory",
  "description": "Stock purchase"
}
```

## Notes

- This backend is separate from the AI service in the `hackathon ai` directory.
- It stores transaction data in MongoDB and exposes summary endpoints for financial reporting.
