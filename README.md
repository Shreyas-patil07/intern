# Intern Backend

Express + MongoDB backend starter.

## Setup

```bash
git clone https://github.com/Shreyas-patil07/intern.git
cd intern
npm install
```

Create `.env` in the project root:

```env
PORT=5000
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_secret_key
```

Start in development:

```bash
npm run dev
```

Production:

```bash
npm start
```

Health check: `http://localhost:5000/health`
