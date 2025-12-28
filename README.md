<p align="center">
  <img src="public/pwa-512x512.png" alt="Sajilo Orders Logo" width="120" />
</p>

<h1 align="center">Sajilo Orders POS</h1>

<p align="center">
  <strong>Modern Restaurant Management System with QR-Based Digital Ordering</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#demo">Demo</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#documentation">Documentation</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=flat-square&logo=tailwindcss" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Supabase-Realtime-3FCF8E?style=flat-square&logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/PWA-Ready-5A0FC8?style=flat-square&logo=pwa" alt="PWA" />
</p>

---

## ✨ Overview

**Sajilo Orders** is a complete restaurant management solution that replaces paper menus, manual order taking, and expensive POS hardware with an elegant digital experience. Customers scan a QR code at their table, browse the menu, and place orders directly from their phones — no app download required.

```
┌─────────────────────────────────────────────────────────────────┐
│   1. SCAN              2. ORDER              3. ENJOY           │
│                                                                 │
│   Customer scans  →    Browse menu,     →    Kitchen prepares,  │
│   QR at table          add to cart,          staff serves       │
│                        place order                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Features

### Customer Experience
| Feature | Description |
|---------|-------------|
| 📱 **QR Code Ordering** | Scan & order from any smartphone — no app needed |
| ❤️ **Favorites** | Remember preferred items across visits |
| ⏱️ **Live Wait Time** | Real-time order status updates |
| 🔔 **Call Waiter** | One-tap service requests |
| 🎯 **Loyalty Points** | Earn rewards and redeem discounts |
| 🌐 **Offline Menu** | Menu loads even with slow internet |

### Staff Dashboard
| Feature | Description |
|---------|-------------|
| 🗺️ **Visual Table Map** | Color-coded table status at a glance |
| 👨‍🍳 **Kitchen Display** | Real-time order queue with prep times |
| 🔊 **Sound Alerts** | Audio notifications for new orders |
| 🧾 **Receipt Printing** | Direct thermal printer support |
| 💵 **Cash Register** | Track cash, expenses, daily totals |
| 📊 **Analytics** | Revenue trends, popular items, peak hours |

### Management
| Feature | Description |
|---------|-------------|
| 📋 **Menu Management** | Add, edit, categorize menu items with images |
| 👥 **Staff Roles** | Admin, Counter, and Kitchen access levels |
| 💳 **Multiple Payments** | Cash and Fonepay QR support |
| 📥 **Data Export** | Download transactions and customer data |
| 🌙 **Dark Mode** | Eye-friendly interface for evening shifts |
| 🔐 **Security** | PIN verification, payment blocks, session management |

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS, shadcn/ui |
| **State** | Zustand, TanStack Query |
| **Backend** | Supabase (PostgreSQL + Realtime) |
| **Storage** | Cloudflare R2 |
| **Hosting** | Cloudflare Pages |
| **PWA** | vite-plugin-pwa |

---

## 📦 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (free tier works)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd sajilo-orders

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Start development server
npm run dev
```

### Environment Variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_R2_PUBLIC_URL=https://your-r2-bucket.r2.dev
```

---

## 📁 Project Structure

```
src/
├── components/         # Reusable UI components
│   ├── layout/        # Navigation, PageLayout
│   └── ui/            # shadcn/ui components
├── hooks/             # Custom React hooks
│   ├── useOfflineSync.ts
│   ├── useSubscription.ts
│   └── ...
├── lib/               # Utilities and API clients
│   ├── supabase.ts
│   ├── apiClient.ts
│   └── ...
├── pages/             # Route components
│   ├── Admin.tsx      # Admin dashboard
│   ├── Counter.tsx    # Counter/cashier view
│   ├── Kitchen.tsx    # Kitchen display
│   ├── TableOrder.tsx # Customer ordering page
│   └── ...
├── store/             # Zustand state management
└── types/             # TypeScript definitions
```

---

## 🔌 Key Routes

| Route | Purpose | Access |
|-------|---------|--------|
| `/` | QR scan landing | Public |
| `/table/:tableNumber` | Customer ordering | Public |
| `/hub` | Staff navigation hub | Staff |
| `/counter` | Counter dashboard | Staff |
| `/kitchen` | Kitchen display | Staff |
| `/admin` | Admin management | Admin |
| `/auth` | Staff login | Public |

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md) | Complete feature overview |
| [TECHNICAL_SETUP_GUIDE.md](./TECHNICAL_SETUP_GUIDE.md) | Step-by-step deployment guide |
| [DATABASE_OPTIMIZATION.md](./DATABASE_OPTIMIZATION.md) | Database schema and optimization |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Production deployment instructions |

---

## 🗃️ Database Schema

```sql
-- Core tables
categories          # Menu categories with sort order
menu_items          # Menu items with prices, images
orders              # Customer orders with status tracking
bills               # Table bills (multiple orders)
transactions        # Completed payments
customers           # Customer loyalty data
staff               # Staff accounts and roles
settings            # Restaurant configuration
expenses            # Daily expense tracking
waiter_calls        # Waiter request queue
payment_blocks      # Anti-fraud cooldown system
```

---

## 🔒 Security Features

- **Payment Blocks**: 3-hour cooldown prevents QR code misuse after payment
- **Staff PIN Verification**: Quick PIN for sensitive actions
- **Session Management**: 4-hour auto-logout for idle sessions
- **Role-Based Access**: Admin, Counter, Kitchen permissions
- **Row Level Security**: Supabase RLS policies

---

## 📱 Progressive Web App

Sajilo Orders is a fully-featured PWA:

- ✅ Installable on any device
- ✅ Offline menu browsing
- ✅ Push notifications (coming soon)
- ✅ Home screen icon
- ✅ Fast loading with caching

---

## 🚀 Deployment

### Cloudflare Pages (Recommended)

1. Connect your GitHub repository to Cloudflare Pages
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Add environment variables
5. Deploy!

### Self-Hosting

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 🤝 Contributing

Contributions are welcome! Please read the contributing guidelines before submitting a PR.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 🙏 Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components
- [Supabase](https://supabase.com/) - Backend infrastructure
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- [Lucide](https://lucide.dev/) - Beautiful icons

---

<p align="center">
  Made with ❤️ for the restaurant industry
</p>
