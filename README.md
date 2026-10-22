# 🎓 Buddy Tracker — Shared Udemy Course Progress API

A modern, robust Express.js backend built with ES modules and Mongoose for tracking shared Udemy course completion among friends and generating real-time course leaderboards.

---

## 🚀 Features

- **ES Modules**: Fully configured with native ECMAScript Modules (`"type": "module"`).
- **Secure Authentication**: User registration and login with bcrypt password hashing and JSON Web Tokens (JWT).
- **Mongoose Data Models**:
  - `User`: Name, unique email, hashed password (excluded by default), auto-generated avatar.
  - `Course`: Title, unique Udemy course ID, total lectures.
  - `Progress`: Compound unique index on `(userId, courseId)`, completed lecture count, optional array of completed lecture IDs, and last watched timestamp.
- **Progress Synchronization**: `PATCH /api/progress/sync` upserts user progress and validates that completed lectures never exceed total course lectures.
- **Leaderboard Aggregation**: `GET /api/courses/:courseId/leaderboard` returns enrolled buddies sorted by highest completion percentage with ranks and completion statistics.
- **Security Hardened**:
  - **Helmet HTTP Headers**: Configured with Content Security Policy (CSP), HTTP Strict Transport Security (HSTS with 1-year preload), `X-Content-Type-Options: nosniff`, and `X-Frame-Options: DENY`.
  - **Strict CORS Whitelisting**: Restricted to the React frontend (`http://localhost:5173`) and Chrome Extension (`chrome-extension://*` or specific `EXTENSION_ID`). Malicious origins are rejected with `403 Forbidden`.
  - **10kb Payload DoS Protection**: Hardened `express.json({ limit: '10kb' })` rejecting oversized request payloads with `413 Payload Too Large`.
  - **Rate Limiting (`express-rate-limit`)**:
    - Auth routes (`POST /api/auth/*`): max 5 attempts per 15 minutes per IP (`429 Too Many Requests`).
    - Sync routes (`PATCH` & `POST /api/progress/sync`): max 60 requests per minute per authenticated user to prevent sync spam.
  - **Zod Schema Validation**: All request bodies and parameters validated with strict Zod schemas ensuring positive integers, valid emails, non-negative lectures, and checking that `completedLectures <= totalLectures`.
  - **NoSQL Injection Prevention (`express-mongo-sanitize`)**: Strips and sanitizes dangerous query operator keys (`$` and `.`) before hitting database queries.

---

## 📁 Project Architecture

```
buddy-tracker/
├── .env.example              # Environment variables template
├── .env                      # Local environment configuration
├── .gitignore
├── package.json              # ES module configuration & dependencies
├── README.md
└── src/
    ├── app.js                # Express app configuration & middleware
    ├── server.js             # Server entry point & DB connection
    ├── config/
    │   ├── db.js             # Mongoose MongoDB connection
    │   └── env.js            # Environment variables loader
    ├── controllers/
    │   ├── authController.js     # User registration, login, profile
    │   ├── courseController.js   # Course creation, listing, leaderboard
    │   └── progressController.js # Upserting & querying course progress
    ├── middleware/
    │   ├── auth.js           # JWT verification middleware
    │   ├── errorHandler.js   # Centralized error handler & 404 handler
    │   └── validate.js       # Input validation schemas & sanitization
    ├── models/
    │   ├── User.js           # Mongoose User schema with bcrypt hooks
    │   ├── Course.js         # Mongoose Course schema
    │   └── Progress.js       # Mongoose Progress schema with unique index
    ├── routes/
    │   ├── authRoutes.js     # /api/auth routes
    │   ├── courseRoutes.js   # /api/courses routes
    │   ├── progressRoutes.js # /api/progress routes
    │   └── index.js          # API route aggregator & health check
    └── utils/
        ├── apiError.js       # Custom ApiError class with HTTP status codes
        └── apiResponse.js    # Standardized JSON response wrapper
```

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory (or copy from `.env.example`):

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/buddy_tracker
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d
CORS_ORIGIN=*
```

---

## 🛠️ Quick Start

### 1. Install Backend & Client Dependencies
```bash
# Install backend dependencies
npm install

# Install client dashboard dependencies
cd client && npm install && cd ..
```

### 2. Run in Development Mode
You can run the backend and client concurrently:

- **Client React Dashboard (Vite on port 5173)**:
  ```bash
  npm run dev:client
  ```
- **Backend API (Express on port 5000)**:
  ```bash
  npm run dev:server
  ```
- **Build Client for Production**:
  ```bash
  npm run build:client
  ```
- **Run Backend Tests (32 unit & integration tests)**:
  ```bash
  npm test
  ```

---

## 📡 API Reference & Endpoints

### 🩺 System & Health
- `GET /` - Root overview and endpoint directory
- `GET /api/health` - API health and uptime status

---

### 🔐 Authentication

#### 1. Register User
- **Method**: `POST /api/auth/register`
- **Body**:
  ```json
  {
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "password": "SecurePassword123",
    "avatar": "https://api.dicebear.com/7.x/bottts/svg?seed=Alice"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "data": {
      "user": {
        "_id": "67b841a1...",
        "name": "Alice Johnson",
        "email": "alice@example.com",
        "avatar": "https://api.dicebear.com/7.x/bottts/svg?seed=Alice",
        "createdAt": "2026-10-22T08:00:00.000Z"
      },
      "token": "eyJhbGciOi..."
    }
  }
  ```

#### 2. Login User
- **Method**: `POST /api/auth/login`
- **Body**:
  ```json
  {
    "email": "alice@example.com",
    "password": "SecurePassword123"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "user": {
        "_id": "67b841a1...",
        "name": "Alice Johnson",
        "email": "alice@example.com",
        "avatar": "https://api.dicebear.com/7.x/bottts/svg?seed=Alice"
      },
      "token": "eyJhbGciOi..."
    }
  }
  ```

#### 3. Current User Profile
- **Method**: `GET /api/auth/me`
- **Headers**: `Authorization: Bearer <token>`

---

### 📚 Courses

#### 1. Add a Course
- **Method**: `POST /api/courses`
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "title": "Complete 2026 Web Development Bootcamp",
    "udemyCourseId": "1565838",
    "totalLectures": 620
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Course created successfully",
    "data": {
      "course": {
        "_id": "67b842f1...",
        "title": "Complete 2026 Web Development Bootcamp",
        "udemyCourseId": "1565838",
        "totalLectures": 620,
        "createdAt": "2026-10-22T08:05:00.000Z"
      }
    }
  }
  ```

#### 2. Get All Courses
- **Method**: `GET /api/courses`

#### 3. Get Course Leaderboard
- **Method**: `GET /api/courses/:courseId/leaderboard`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Leaderboard fetched successfully",
    "data": {
      "course": {
        "id": "67b842f1...",
        "title": "Complete 2026 Web Development Bootcamp",
        "udemyCourseId": "1565838",
        "totalLectures": 620
      },
      "enrolledCount": 3,
      "leaderboard": [
        {
          "rank": 1,
          "user": {
            "id": "67b841a1...",
            "name": "Alice Johnson",
            "email": "alice@example.com",
            "avatar": "https://api.dicebear.com/7.x/bottts/svg?seed=Alice"
          },
          "completedLectures": 496,
          "totalLectures": 620,
          "completionPercentage": 80.0,
          "lastWatchedAt": "2026-10-22T08:30:00.000Z",
          "completedLectureIdsCount": 496
        },
        {
          "rank": 2,
          "user": {
            "id": "67b841b2...",
            "name": "Bob Smith",
            "email": "bob@example.com",
            "avatar": "https://api.dicebear.com/7.x/bottts/svg?seed=Bob"
          },
          "completedLectures": 310,
          "totalLectures": 620,
          "completionPercentage": 50.0,
          "lastWatchedAt": "2026-10-22T08:15:00.000Z",
          "completedLectureIdsCount": 310
        }
      ]
    }
  }
  ```

---

### 📈 Progress Tracking

#### 1. Sync User Progress (Upsert)
- **Method**: `PATCH /api/progress/sync`
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "courseId": "67b842f1...",
    "completedLectures": 150,
    "completedLectureIds": ["lec_1", "lec_2", "lec_3"]
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Progress synchronized successfully",
    "data": {
      "progress": {
        "_id": "67b84500...",
        "userId": "67b841a1...",
        "courseId": {
          "_id": "67b842f1...",
          "title": "Complete 2026 Web Development Bootcamp",
          "udemyCourseId": "1565838",
          "totalLectures": 620
        },
        "completedLectures": 150,
        "completedLectureIds": ["lec_1", "lec_2", "lec_3"],
        "lastWatchedAt": "2026-10-22T08:45:00.000Z"
      },
      "stats": {
        "completedLectures": 150,
        "totalLectures": 620,
        "completionPercentage": 24.2,
        "isCompleted": false
      }
    }
  }
  ```

#### 2. Get User's Progress for a Specific Course
- **Method**: `GET /api/progress/:courseId`
- **Headers**: `Authorization: Bearer <token>`

#### 3. Get All Courses Progress for Current User
- **Method**: `GET /api/progress`
- **Headers**: `Authorization: Bearer <token>`
