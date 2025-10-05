# AI-Powered Image Editor - Whop App

An AI-powered image editing application built as a Whop app, allowing users to edit images using natural language instructions powered by Google's Gemini AI.

![Next.js](https://img.shields.io/badge/Next.js-15.5.4-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=flat-square&logo=tailwind-css)
![Whop](https://img.shields.io/badge/Whop-Integrated-purple?style=flat-square)

## 🚀 Features

- **AI-Powered Image Editing**: Edit images using natural language prompts (e.g., "make the jersey blue", "add a sunset background")
- **Drag & Drop Upload**: Easy image upload with drag-and-drop interface
- **Version History**: Track all edits with visual history sidebar
- **Whop Integration**: Full integration with Whop's monetization platform
  - Dashboard for creators to manage settings
  - Discover page for app marketing
  - Seamless authentication
- **Real-time Processing**: Instant image editing powered by Gemini 2.5 Flash

## 🛠️ Tech Stack

- **Frontend**: Next.js 15.5.4, React 19, TypeScript
- **Styling**: Tailwind CSS v4
- **AI Engine**: Google Gemini 2.5 Flash (gemini-2.5-flash-image)
- **Monetization**: Whop SDK (@whop/api, @whop/react)
- **Deployment**: Vercel

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Google AI Studio API key
- Whop developer account

## 🔧 Installation

1. Clone the repository:
```bash
git clone https://github.com/Travisp-cyber/Nana-Kick.git
cd my-nextjs-app
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file in the root directory:

```env
# Google AI API Key
GOOGLE_AI_API_KEY=your_google_ai_api_key

# Whop App Configuration
NEXT_PUBLIC_WHOP_APP_ID=your_whop_app_id
WHOP_API_KEY=your_whop_api_key
NEXT_PUBLIC_WHOP_AGENT_USER_ID=your_agent_user_id
NEXT_PUBLIC_WHOP_COMPANY_ID=your_company_id
```

## 🚀 Development

Run the development server with Whop proxy:

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

### Available Scripts

- `npm run dev` - Start development server with Whop proxy
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## 📁 Project Structure

```
my-nextjs-app/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── process-image/    # AI image processing endpoint
│   │   │   └── webhooks/         # Whop webhook handlers
│   │   ├── dashboard/            # Creator dashboard
│   │   ├── discover/             # App store listing page
│   │   ├── experiences/          # Main image editor
│   │   └── layout.tsx            # Root layout with WhopApp
│   ├── lib/
│   │   └── whop-sdk.ts          # Whop SDK configuration
│   └── middleware.ts             # CORS and request handling
├── public/                       # Static assets
├── .env.local                    # Environment variables
└── package.json
```

## 🎯 Whop App Views

### 1. Experience View (`/experiences/[experienceId]`)
The main image editor where users can:
- Upload images
- Enter editing instructions
- View and restore from edit history

### 2. Dashboard View (`/dashboard/[companyId]`)
Admin panel for creators to:
- View app settings
- Configure usage limits (coming soon)
- Access analytics (coming soon)

### 3. Discover View (`/discover`)
Marketing page showcasing:
- App features
- Use cases
- Call-to-action for installation

## 🔑 API Endpoints

### `/api/process-image`
- **Method**: POST
- **Body**: FormData with `image` (File) and `instructions` (string)
- **Response**: Edited image as binary data or error JSON

### `/api/webhooks`
- **Method**: POST
- **Purpose**: Handle Whop events (installations, memberships, etc.)

## 🚢 Deployment

The app is configured for deployment on Vercel:

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

Current deployment: [https://nana-kick-3ubr-mc0tdw1v8-travis-parks-projects.vercel.app](https://nana-kick-3ubr-mc0tdw1v8-travis-parks-projects.vercel.app)

## 🔒 Environment Variables for Production

In Vercel, add these environment variables:
- `GOOGLE_AI_API_KEY`
- `NEXT_PUBLIC_WHOP_APP_ID`
- `WHOP_API_KEY`
- `NEXT_PUBLIC_WHOP_AGENT_USER_ID`
- `NEXT_PUBLIC_WHOP_COMPANY_ID`

## 📝 Whop Configuration

In your Whop dashboard, configure these URLs:
- **App URL**: `https://your-app.vercel.app`
- **Experience URL**: `https://your-app.vercel.app/experiences/[experienceId]`
- **Dashboard URL**: `https://your-app.vercel.app/dashboard/[companyId]`
- **Discover URL**: `https://your-app.vercel.app/discover`
- **Webhook URL**: `https://your-app.vercel.app/api/webhooks`

## 🎨 How It Works

1. User uploads an image
2. User provides editing instructions (e.g., "make the sky more dramatic")
3. Image and instructions are sent to Google Gemini 2.5 Flash
4. AI processes the image and returns the edited version
5. Edited image is displayed with version history

## 🔜 Coming Soon

- **Supabase Integration**: Persistent storage for editing history
- **Usage Limits**: Track and limit edits based on membership tier
- **User Preferences**: Save custom presets and settings
- **Analytics Dashboard**: View usage statistics and popular edits
- **Batch Processing**: Edit multiple images at once
- **Advanced Filters**: Pre-built editing templates

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is private and proprietary.

## 🙏 Acknowledgments

- Google Gemini AI for powerful image editing capabilities
- Whop for the monetization platform
- Vercel for seamless deployment

---

Built with ❤️ by Travis Park
