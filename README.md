# Kenya ni Yetu - Political Transparency Platform

![Kenya ni Yetu](https://img.shields.io/badge/Kenya%20ni%20Yetu-Political%20Transparency-green)
![Next.js](https://img.shields.io/badge/Next.js-13+-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.0+-38B2AC)

**Kenya ni Yetu** is a comprehensive political transparency platform designed to empower Kenyan citizens with unbiased information about their political representatives. The platform provides transparency scores, tracks political promises, monitors legal cases, and enables citizen reporting of political misconduct.

## 🌟 Features

### Core Functionality
- **🔍 Politician Search & Discovery**: Advanced search with filtering by party, county, position, and transparency scores
- **📊 Transparency Scoring**: AI-powered scoring system based on legal records, promise fulfillment, public sentiment, and credential verification
- **📈 Real-time Alerts & Trends**: Track trending politicians and flagged updates
- **📝 Citizen Reporting**: Anonymous report submission system for political misconduct
- **🔗 Political Network Analysis**: Visualize connections between politicians and key associates
- **📱 Responsive Design**: Optimized for desktop, tablet, and mobile devices

### Key Pages & Sections
- **Home Page**: Hero section with search, featured politicians, and quick statistics
- **Search & Results**: Comprehensive politician directory with advanced filtering
- **Politician Profiles**: Detailed profiles with scores, cases, promises, and political linkages
- **Alerts & Trends**: Real-time updates on political developments and trending figures
- **Flagged Updates**: Comprehensive incident tracking and investigation management
- **Report Submission**: Secure, anonymous reporting system with evidence upload
- **Explore**: Interactive politician directory with multiple view modes

## 🛠 Tech Stack

### Frontend
- **Framework**: Next.js 13+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Icons**: Lucide React
- **Charts**: Recharts
- **Date Handling**: date-fns

### Backend Integration Ready
- **API**: Designed for FastAPI backend integration
- **Database**: PostgreSQL (recommended)
- **Authentication**: NextAuth.js ready
- **File Storage**: Vercel Blob or AWS S3 compatible

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm, yarn, or pnpm
- Git

### Installation

1. **Clone the repository**
   \`\`\`bash
   git clone https://github.com/your-username/kenya-ni-yetu.git
   cd kenya-ni-yetu
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   \`\`\`

3. **Set up environment variables**
   \`\`\`bash
   cp .env.example .env.local
   \`\`\`
   
   Edit `.env.local` with your configuration:
   \`\`\`env
   # App Configuration
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   
   # Database (when ready for backend integration)
   DATABASE_URL=postgresql://username:password@localhost:5432/kenya_ni_yetu
   
   # Authentication (optional)
   NEXTAUTH_SECRET=your-secret-key
   NEXTAUTH_URL=http://localhost:3000
   
   # File Upload (optional)
   BLOB_READ_WRITE_TOKEN=your-vercel-blob-token
   
   # Backend API
   NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
   \`\`\`

4. **Run the development server**
   \`\`\`bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   \`\`\`

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

\`\`\`
kenya-ni-yetu/
├── app/                          # Next.js 13+ App Router
│   ├── components/              # Reusable UI components
│   │   ├── header.tsx
│   │   ├── footer.tsx
│   │   ├── search-bar.tsx
│   │   ├── politician-card.tsx
│   │   └── ...
│   ├── alerts/                  # Alerts & Trends page
│   ├── explore/                 # Politician directory
│   ├── flagged-updates/         # Incident tracking
│   │   └── [id]/               # Individual report details
│   ├── politician/              # Politician profiles
│   │   └── [id]/               # Individual politician pages
│   ├── search/                  # Search results
│   ├── submit-report/           # Report submission
│   ├── globals.css             # Global styles
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Home page
├── components/                  # shadcn/ui components
│   └── ui/
├── lib/                        # Utility functions
├── public/                     # Static assets
├── types/                      # TypeScript type definitions
├── .env.example               # Environment variables template
├── next.config.js             # Next.js configuration
├── tailwind.config.js         # Tailwind CSS configuration
├── tsconfig.json              # TypeScript configuration
└── package.json               # Dependencies and scripts
\`\`\`

## 🌐 Deployment

### Deploy to Vercel (Recommended)

1. **Push to GitHub**
   \`\`\`bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   \`\`\`

2. **Deploy with Vercel**
   
   **Option A: Vercel CLI**
   \`\`\`bash
   npm i -g vercel
   vercel
   \`\`\`
   
   **Option B: Vercel Dashboard**
   - Visit [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Configure environment variables
   - Deploy

3. **Configure Environment Variables**
   In your Vercel dashboard, add the following environment variables:
   \`\`\`
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
   DATABASE_URL=your-production-database-url
   NEXTAUTH_SECRET=your-production-secret
   NEXTAUTH_URL=https://your-app.vercel.app
   \`\`\`

### Deploy to Other Platforms

#### Netlify
\`\`\`bash
npm run build
npm run export
\`\`\`
Upload the `out` folder to Netlify.

#### Railway
\`\`\`bash
railway login
railway init
railway up
\`\`\`

#### Docker
\`\`\`dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
\`\`\`

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NEXT_PUBLIC_APP_URL` | Public URL of your app | Yes | `http://localhost:3000` |
| `DATABASE_URL` | PostgreSQL connection string | No* | - |
| `NEXTAUTH_SECRET` | NextAuth.js secret key | No* | - |
| `NEXTAUTH_URL` | NextAuth.js URL | No* | - |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage token | No | - |
| `NEXT_PUBLIC_API_BASE_URL` | Backend API base URL | No* | `http://localhost:8000/api/v1` |

*Required when integrating with backend services

### Customization

#### Styling
- Modify `tailwind.config.js` for custom colors and themes
- Update `app/globals.css` for global styles
- Customize shadcn/ui components in `components/ui/`

#### Content
- Update politician data in component files (currently using mock data)
- Modify text content in page components
- Add your organization's branding in `components/header.tsx` and `components/footer.tsx`

## 🔌 API Integration

The frontend is designed to work with a FastAPI backend. To integrate:

1. **Update API endpoints** in component files
2. **Replace mock data** with actual API calls
3. **Add authentication** using NextAuth.js
4. **Configure CORS** in your backend

Example API integration:
\`\`\`typescript
// lib/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

export async function fetchPoliticians() {
  const response = await fetch(`${API_BASE_URL}/politicians`)
  return response.json()
}

export async function fetchPolitician(id: string) {
  const response = await fetch(`${API_BASE_URL}/politicians/${id}`)
  return response.json()
}
\`\`\`

## 📊 Data Structure

### Politician Profile
\`\`\`typescript
interface Politician {
  id: string
  name: string
  position: string
  party: string
  county: string
  photo: string
  transparencyScore: number
  confidence: number
  scoreBreakdown: {
    legalRecord: number
    promiseFulfillment: number
    publicSentiment: number
    educationVerification: number
  }
  cases: Case[]
  promises: Promise[]
  linkages: PoliticalLinkage[]
}
\`\`\`

### Flagged Update
\`\`\`typescript
interface FlaggedUpdate {
  id: string
  politician: PoliticianSummary
  issue: string
  description: string
  status: 'Under Review' | 'Investigating' | 'Verified' | 'Dismissed'
  priority: 'High' | 'Medium' | 'Low'
  dateReported: string
  evidence: EvidenceItem[]
  timeline: TimelineItem[]
}
\`\`\`

## 🧪 Testing

\`\`\`bash
# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e
\`\`\`

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
   \`\`\`bash
   git checkout -b feature/amazing-feature
   \`\`\`
3. **Make your changes**
4. **Add tests** for new functionality
5. **Commit your changes**
   \`\`\`bash
   git commit -m "Add amazing feature"
   \`\`\`
6. **Push to your branch**
   \`\`\`bash
   git push origin feature/amazing-feature
   \`\`\`
7. **Open a Pull Request**

### Development Guidelines
- Follow TypeScript best practices
- Use meaningful commit messages
- Add JSDoc comments for complex functions
- Ensure responsive design
- Test on multiple browsers
- Follow accessibility guidelines (WCAG 2.1)

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Report bugs and request features via [GitHub Issues](https://github.com/your-username/kenya-ni-yetu/issues)
- **Discussions**: Join conversations in [GitHub Discussions](https://github.com/your-username/kenya-ni-yetu/discussions)
- **Email**: Contact us at support@kenyaniyetu.org

## 🗺 Roadmap

### Phase 1 (Current)
- ✅ Core UI components and pages
- ✅ Responsive design
- ✅ Mock data integration
- ✅ Search and filtering
- ✅ Report submission system

### Phase 2 (Next)
- 🔄 Backend API integration
- 🔄 User authentication
- 🔄 Real-time notifications
- 🔄 Advanced analytics dashboard
- 🔄 Mobile app (React Native)

### Phase 3 (Future)
- 📋 AI-powered content moderation
- 📋 Multi-language support (Swahili, English)
- 📋 SMS integration for rural areas
- 📋 Blockchain verification system
- 📋 Public API for developers

## 🙏 Acknowledgments

- **Design Inspiration**: Modern government transparency platforms
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
- **Icons**: [Lucide](https://lucide.dev/)
- **Framework**: [Next.js](https://nextjs.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)

## 📈 Analytics & Monitoring

For production deployment, consider integrating:
- **Analytics**: Google Analytics, Plausible, or Vercel Analytics
- **Error Tracking**: Sentry or Bugsnag
- **Performance**: Vercel Speed Insights or Web Vitals
- **Uptime Monitoring**: Uptime Robot or Pingdom

---

**Built with ❤️ for Kenyan democracy and transparency**

For more information, visit our [website](https://kenyaniyetu.org) or follow us on social media.
