<div align="center">
  <img src="https://raw.githubusercontent.com/joeinus134131/scrappler/main/apps/dashboard/public/favicon.ico" alt="Scrappler Logo" width="100" />

  # 🕸️ Scrappler Engine
  
  **An Enterprise-Grade Social Intelligence & Geospatial Data Aggregator**

  [![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org/)
  [![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?logo=nodedotjs)](https://nodejs.org/)
  [![Playwright](https://img.shields.io/badge/Playwright-Stealth-2EAD33?logo=playwright)](https://playwright.dev/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Vector_DB-4169E1?logo=postgresql)](https://postgresql.org/)
  [![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://prisma.io/)
  [![Socket.io](https://img.shields.io/badge/Socket.io-Realtime-010101?logo=socketdotio)](https://socket.io/)
</div>

<br />

<div align="center">
  <img src="https://github-readme-stats.vercel.app/api/pin/?username=joeinus134131&repo=scrappler&theme=react&bg_color=0f172a&title_color=38bdf8&text_color=94a3b8" alt="Repo Stats" />
</div>

## 🚀 Overview
**Scrappler** is a robust, monorepo-based data extraction architecture designed for high-scale, real-time social media and demographic data aggregation. 

Moving beyond traditional brittle web scrapers, Scrappler operates as an intelligent **Command Center**. It orchestrates background scraping tasks via BullMQ, bypasses anti-bot systems via RapidAPI/Apify integrations, and visualizes live sentiment and geospatial heatmaps on a beautiful, modern Dashboard.

## ✨ Key Features
- **🌐 Third-Party API Framework:** Built-in client to seamlessly integrate with RapidAPI, Apify, or government BPS endpoints.
- **🗺️ Geospatial Tracking:** Real-time FlyTo map integrations powered by `react-leaflet` to visualize population check-ins and trending geographic zones.
- **🧠 AI Sentiment Analysis:** Automatically classifies extracted unstructured data into Positive/Neutral/Negative datasets.
- **⚡ Real-Time Telemetry:** Websocket (`socket.io`) streams live terminal logs directly from the backend Node.js worker to the Next.js Dashboard.
- **📦 Reliable Job Queue:** `BullMQ` and `Redis` ensure background jobs never drop, automatically retrying upon failure.

## 🏗️ Architecture
This project utilizes a **Monorepo** structure powered by npm workspaces.
```bash
scrappler/
├── apps/
│   ├── dashboard/   # Next.js 14 Frontend (Port 3000)
│   └── engine/      # Node.js Express Backend & BullMQ Worker (Port 4000)
├── packages/        # Shared types and utilities
└── docker-compose.yml # PostgreSQL & Redis Infrastructure
```

## 📈 Developer Stats

<div align="center">
  <img src="https://github-readme-stats.vercel.app/api?username=joeinus134131&show_icons=true&theme=react&bg_color=0f172a&title_color=38bdf8&text_color=94a3b8" alt="Joeinus GitHub Stats" />
  <img src="https://github-readme-stats.vercel.app/api/top-langs/?username=joeinus134131&layout=compact&theme=react&bg_color=0f172a&title_color=38bdf8&text_color=94a3b8" alt="Top Languages" />
</div>

## ⚙️ Quick Start

### 1. Requirements
- Node.js 18+
- Docker & Docker Compose

### 2. Infrastructure Setup
Boot up the required databases (PostgreSQL & Redis):
```bash
docker-compose up -d
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Database Seeding
Push the Prisma Schema and seed initial data:
```bash
cd apps/engine
npx prisma db push
npm run seed
```

### 5. Launch the System
Start both the Frontend Dashboard and the Backend Engine simultaneously:
```bash
npm run dev
```

Visit **`http://localhost:3000`** to access the Mission Control Dashboard.

## 🛡️ API Configuration
To utilize the full potential of demographic and platform-specific extraction without hitting login walls:
1. Navigate to **Settings** in the Dashboard.
2. Enter your **RapidAPI Key** or **Apify Token**.
3. The engine will automatically switch from local headless scraping to the high-performance API aggregator.

---
*Developed with modern web standards and enterprise-grade resilience.*
