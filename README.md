# Kira — Your Friendly Guide Through Anything

A multi-tenant AI companion platform where users get a patient, knowledgeable guide through learning new skills, planning projects, or mastering anything.

## 🎯 Vision

**For Individuals:** A friendly AI companion who guides you through anything — learning to code, planning a wedding, mastering a new skill. Like having a patient, knowledgeable friend available 24/7.

**For Businesses:** What does your team spend hours explaining to customers? Kira can do that — onboarding, support, training, guidance — so your people can focus on what matters.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/dennissolver/Kira.git
cd Kira
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env.local
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🛠 Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL + pgvector)
- **Voice AI:** ElevenLabs Conversational AI
- **Embeddings:** Voyage AI
- **Payments:** Stripe
- **Hosting:** Vercel

## 📁 Project Structure

```
kira-project/
├── app/
│   ├── globals.css     # Global styles + Kira brand
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Landing page
├── components/         # Reusable components
├── public/
│   └── kira-avatar.jpg # Kira's face
├── tailwind.config.ts  # Tailwind + brand colors
└── package.json
```

## 🎨 Brand

- **Primary Color:** Kira Warm (#FF6B4A)
- **Font (Display):** Fraunces
- **Font (Body):** DM Sans
- **Avatar:** Kira's friendly face is used consistently across all UI

## 📝 License

Private — All rights reserved.
