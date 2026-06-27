# Melina Community — Land Development Management App

## Architecture
- **Frontend**: React 18 + Tailwind CSS → AWS Amplify Hosting
- **Auth**: AWS Cognito (self-registration, email verification, password reset)
- **Backend API**: Node/Express → AWS Lambda + API Gateway (or EC2/ECS)
- **Database**: AWS RDS PostgreSQL

---

## 1. Database Setup (RDS PostgreSQL)

1. Create an RDS PostgreSQL 15+ instance in your VPC
2. Create the database and run the schema:
```bash
psql -h YOUR_RDS_HOST -U postgres -c "CREATE DATABASE melina;"
psql -h YOUR_RDS_HOST -U melina_user -d melina -f database/schema.sql
```
3. Note your connection details for the backend env vars

---

## 2. Cognito Setup

1. Go to AWS Cognito → Create User Pool
2. Sign-in: **Email**
3. Password policy: min 8 chars, upper + lower + number
4. Self-registration: **Enabled**
5. Email verification: **Required**
6. Create an App Client (no secret for SPA)
7. Note your **User Pool ID** and **App Client ID**

---

## 3. Backend API Deployment

### Option A — Lambda + API Gateway (Serverless)
```bash
cd server
npm install
# Install AWS SAM or Serverless Framework
npx serverless deploy
```

### Option B — EC2 / ECS
```bash
cd server
cp .env.example .env   # fill in your values
npm install
npm start
```

**Required env vars for the backend:**
```
DB_HOST=your-rds-endpoint.rds.amazonaws.com
DB_PORT=5432
DB_NAME=melina
DB_USER=melina_user
DB_PASSWORD=your-password
COGNITO_USER_POOL=us-east-1_XXXXXXXXX
APP_REGION=us-east-1
FRONTEND_URL=https://your-amplify-app.amplifyapp.com
PORT=4000
```

---

## 4. Frontend — Amplify Hosting

### Connect to Amplify
1. Push this repo to GitHub / CodeCommit / Bitbucket
2. AWS Amplify Console → **New App → Host web app**
3. Connect your repo and select the branch
4. Amplify auto-detects `amplify.yml` for the build

### Environment Variables (set in Amplify Console)
```
REACT_APP_USER_POOL_ID         = us-east-1_XXXXXXXXX
REACT_APP_USER_POOL_CLIENT_ID  = XXXXXXXXXXXXXXXXXXXXXXXXXX
REACT_APP_REGION           = us-east-1
REACT_APP_API_ENDPOINT         = https://your-api-gateway-url/prod
```

### Local Development
```bash
# Frontend
cp .env.example .env.local
npm install
npm start

# Backend (separate terminal)
cd server
npm install
npm run dev
```

### AI Chat (Claude + MCP)

The app includes a floating chat widget that connects to the standalone **[mcp-chat-bridge](https://github.com/your-org/mcp-chat-bridge)** project.

Set these frontend environment variables to point at the deployed bridge:

```bash
REACT_APP_CHAT_API_ENDPOINT=https://your-chat-bridge-api.amazonaws.com/prod
REACT_APP_CHAT_MCP_SERVER_ID=land_finance
```

The widget will appear in the bottom-right corner and will tell the bridge which MCP server to use.

---

## 5. Features

### ✅ Core (this release)
- **Login / Self-Registration** — Cognito email auth with verification
- **Dashboard** — KPI cards, revenue timeline chart, upcoming takedowns by 30/60/90/180-day window, overdue alerts
- **Builder Manager** — Full CRUD for builders, contracts, and unlimited tranches; live escalation preview when adding a tranche
- **Cash Flow** — Monthly revenue grid, toggle between Revenue / Earnest Money / Both views, Export to Excel

### 🔜 Next release
- Receivables entry (log actual payments)
- Aging report (current / 30 / 60 / 90+ days past due)
- User roles (admin / editor / viewer)

---

## Project Structure
```
melina-app/
├── src/
│   ├── api/client.js          # All API fetch calls
│   ├── api/chat.js            # Chat bridge API client
│   ├── components/Layout.jsx  # Sidebar + nav
│   ├── components/ChatWidget.jsx # Floating AI chat window
│   ├── context/AppContext.jsx  # Global state
│   ├── pages/
│   │   ├── Dashboard.jsx       # KPIs + upcoming payments
│   │   ├── BuilderManager.jsx  # CRUD builders/contracts/tranches
│   │   └── CashFlow.jsx        # Monthly grid + Excel export
│   └── utils/calculations.js  # Escalation math (shared)
├── server/
│   ├── index.js               # Express API + all routes
│   └── package.json
├── mcp-server/
│   └── src/index.js           # MCP server exposing land-finance tools
├── database/
│   └── schema.sql             # Full Postgres schema + seed data
├── amplify.yml                # Amplify build config
└── .env.example               # All required env vars
```
