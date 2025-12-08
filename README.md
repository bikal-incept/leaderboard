# InceptLabs Evaluation Portal

A modern web application for managing benchmarks, evaluations, and evaluator comments built with React, TypeScript, and Vite.

## Features

- 🔐 **Authentication System** - Secure login page
- 📊 **Benchmarks Dashboard** - View and manage benchmarks
- 📝 **Evaluations** - Track and manage evaluations with experiment reports
- 🔄 **Compare Reports** - Compare up to 3 cached experiment reports side-by-side
- 💬 **Evaluator Comments** - Review and manage evaluator feedback
- 📊 **Data Explorer** - Browse and analyze raw data
- 🎨 **Modern UI** - Clean and responsive interface with Lucide icons
- 🌙 **Dark/Light Theme** - Toggle between dark and light modes

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **React Router** - Client-side routing
- **Lucide React** - Modern icon library
- **date-fns** - Date utility library

## Prerequisites

Before running this project, make sure you have the following installed:

- **Node.js** (version 16 or higher recommended)
- **npm** or **yarn** package manager

## Getting Started

### 1. Installation

Clone the repository and install dependencies:

```bash
# Install dependencies
npm install
```

### 2. Development

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (default Vite port).

The dev server includes:
- ⚡ Hot Module Replacement (HMR)
- 🔄 Fast refresh for React components
- 📦 Instant server start

### 3. Build for Production

Create an optimized production build:

```bash
npm run build
```

This will:
1. Run TypeScript compiler to check for type errors
2. Create an optimized build in the `dist` folder

### 4. Preview Production Build

Test the production build locally:

```bash
npm run preview
```

This serves the built application from the `dist` folder.

## Project Structure

```
incept_evaluation_portal/
├── src/
│   ├── components/       # Reusable React components
│   │   └── Layout.tsx    # Main layout with navigation
│   ├── pages/           # Page components
│   │   ├── Login.tsx    # Authentication page
│   │   ├── Benchmarks.tsx      # Leaderboards page
│   │   ├── Evaluations.tsx     # Experiment reports
│   │   ├── CompareReports.tsx  # Compare experiments (NEW)
│   │   ├── LookAtData.tsx      # Data explorer
│   │   └── EvaluatorComments.tsx
│   ├── data/            # Mock data and constants
│   │   ├── mockEvaluations.ts
│   │   └── leaderboardData.ts
│   ├── services/        # Database and API services
│   │   └── db.ts
│   ├── types/           # TypeScript type definitions
│   ├── App.tsx          # Main application component
│   ├── main.tsx         # Application entry point
│   └── index.css        # Global styles
├── services/            # Backend services (Node.js)
│   ├── db.ts
│   └── queries.ts
├── scripts/             # Utility scripts
├── index.html           # HTML template
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite configuration
├── EXPERIMENT_REPORT_FEATURE.md
├── COMPARE_REPORTS_FEATURE.md  # New feature documentation
└── README.md           # This file
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally

## Development Workflow

1. Start the dev server with `npm run dev`
2. Make changes to the code - HMR will update the browser automatically
3. Build for production when ready with `npm run build`
4. Test the production build with `npm run preview`

## Key Features Guide

### Leaderboards (Benchmarks)
View experiment performance rankings with filtering by subject, grade level, and question type. Click on any experiment row to view detailed reports.

### Evaluations (Experiment Reports)
- View detailed experiment performance broken down by difficulty
- See latency metrics (TTFT, Total Generation Time) with percentiles
- Analyze evaluator scores distribution
- Filter by subject, grade level, and question type
- Reports are automatically cached for comparison

### Compare Reports (NEW)
- Compare up to 3 cached experiment reports side-by-side
- Compare latency metrics across difficulties
- Compare performance (success rates) across difficulties
- View evaluator score distributions with bar charts
- Manage cached reports (view, select, delete)

### Data Explorer
Browse and analyze raw data from experiments with advanced filtering and search capabilities.

## Login

The application includes an authentication system. Access the login page at the root URL when starting the application.

## Browser Support

This project uses modern JavaScript features and targets:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Troubleshooting

### Port already in use

If port 5173 is already in use, Vite will automatically try the next available port (5174, 5175, etc.).

### Module not found errors

Clear node_modules and reinstall:

```bash
rm -rf node_modules package-lock.json
npm install
```

### TypeScript errors

Check your TypeScript configuration and ensure all type definitions are installed:

```bash
npm install --save-dev @types/react @types/react-dom
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is private and proprietary to InceptLabs.

## Support

For questions or issues, please contact the InceptLabs development team.

