# AI-Powered Image Editor - Whop App

An AI-powered image editing application built as a Whop app, allowing users to edit images using natural language instructions powered by Google's Gemini AI.

![Next.js](https://img.shields.io/badge/Next.js-15.5.4-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=flat-square&logo=tailwind-css)
![Whop](https://img.shields.io/badge/Whop-Integrated-purple?style=flat-square)

## 🚀 Features

- **AI-Powered Image Editing**: Edit images using natural language prompts (e.g., "make the jersey blue", "add a sunset background")
- **10 Free Generations**: New users get 10 free AI edits to try before purchasing
- **Drag & Drop Upload**: Easy image upload with drag-and-drop interface
- **Version History**: Track all edits with visual history sidebar
- **Whop Integration**: Full integration with Whop's monetization platform
  - Dashboard for creators to manage settings
  - Discover page for app marketing
  - Seamless authentication
- **Real-time Processing**: Instant image editing powered by Gemini 2.5 Flash
- **Usage Tracking**: Tier-based generation limits with automated daily resets
- **Overage Pricing**: Automatic per-generation charges when users exceed their plan limits
- **Health Monitoring**: Built-in health check endpoint for system monitoring

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

### Core Configuration
- `GOOGLE_AI_API_KEY` - Google AI API key for image processing
- `NEXT_PUBLIC_WHOP_APP_ID` - Your Whop App ID
- `WHOP_API_KEY` - Your Whop API key (keep secret!)
- `NEXT_PUBLIC_WHOP_AGENT_USER_ID` - Your Whop agent user ID
- `NEXT_PUBLIC_WHOP_COMPANY_ID` - Your Whop company ID
- `ADMIN_WHOP_USER_IDS` - Comma-separated admin user IDs

### Access Pass Configuration (Required!)
These IDs gate access to premium features:
- `NEXT_PUBLIC_ACCESS_PASS_STARTER_ID` - Starter Pack ($9/month)
- `NEXT_PUBLIC_ACCESS_PASS_CREATOR_ID` - Creator Pack ($29/month)
- `NEXT_PUBLIC_ACCESS_PASS_PRO_ID` - Pro Pack ($99/month)
- `NEXT_PUBLIC_ACCESS_PASS_BRAND_ID` - Brand Pack ($69/month)

### Plan IDs (for checkout)
- `NEXT_PUBLIC_WHOP_PLAN_STARTER_ID`
- `NEXT_PUBLIC_WHOP_PLAN_CREATOR_ID`
- `NEXT_PUBLIC_WHOP_PLAN_PRO_ID`
- `NEXT_PUBLIC_WHOP_PLAN_BRAND_ID`

📖 **See [ENVIRONMENT_VARIABLES_GUIDE.md](./ENVIRONMENT_VARIABLES_GUIDE.md) for detailed setup instructions**

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

## 🚀 Ready to Launch?

This app is production-ready! Follow these steps:

1. **Complete Setup**: See [LAUNCH_GUIDE.md](./LAUNCH_GUIDE.md) for detailed testing and launch instructions
2. **Generate CRON_SECRET**: Run `bash setup-cron-secret.sh` to generate your cron authentication secret
3. **Test User Flow**: Follow Phase 1 in LAUNCH_GUIDE.md to test the complete purchase → usage flow
4. **Deploy**: Push to Vercel and verify all environment variables are set
5. **Publish**: Make your Whop app public!

### New Features (Just Added!)

- ✅ **Automated Daily Usage Reset**: Vercel cron job resets user limits on their individual subscription anniversary
- ✅ **Health Check Endpoint**: `/api/health` for monitoring system status
- ✅ **Production Ready**: Complete with error handling, logging, and monitoring

### Quick Health Check

Test your deployment:
```bash
curl https://your-app.vercel.app/api/health
```

## 🔜 Coming Soon

- **Analytics Dashboard**: View usage statistics and popular edits
- **Batch Processing**: Edit multiple images at once
- **Advanced Filters**: Pre-built editing templates
- **Overage Billing**: Allow users to purchase additional generations beyond their tier limit

## 🤝 Contributing & Getting Help

Contributions, bug reports, and feature requests are welcome! To help me assist you effectively, please provide the following context:

### 🐛 Reporting Bugs

When reporting a bug, include:

- **Environment Details**:
  - Node.js version: `node --version`
  - npm/yarn version
  - Operating system (macOS, Windows, Linux)
  - Browser (if frontend issue)

- **Steps to Reproduce**:
  1. Clear, numbered steps to recreate the issue
  2. Include specific commands, URLs, or actions taken
  3. Attach screenshots or screen recordings if applicable

- **Expected vs. Actual Behavior**:
  - What you expected to happen
  - What actually happened
  - Error messages (full stack traces are helpful!)

- **Code Context**:
  - Relevant file paths and line numbers
  - Code snippets showing the problematic area
  - Recent changes that might be related

### ✨ Requesting Features

When requesting a feature, include:

- **Use Case**: Describe the problem you're trying to solve
- **Proposed Solution**: Your idea for how it should work
- **Alternatives Considered**: Other approaches you've thought about
- **Priority**: How urgent is this for your workflow?

### 🔐 Security Note

**Never share actual API keys, tokens, or secrets in issues or pull requests.** If your issue involves authentication or API configuration, use placeholders like `{{GOOGLE_AI_API_KEY}}` or `{{WHOP_API_KEY}}`.

### 💬 Questions & Support

For general questions:
- Check existing issues first
- Include what you've already tried
- Share relevant documentation you've consulted
- Provide context about your specific setup or use case

## 📄 License

This project is private and proprietary.

## 🙏 Acknowledgments

- Google Gemini AI for powerful image editing capabilities
- Whop for the monetization platform
- Vercel for seamless deployment

---

Built with ❤️ by Travis Park
