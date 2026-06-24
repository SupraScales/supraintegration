# Supra Integration

AI integration agency website — [supraintegration.ai](https://supraintegration.ai)

## Stack

- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS v4
- **Hosting:** Vercel (auto-deploys on push to `main`)
- **Language:** TypeScript

## Development

```bash
npm run dev       # Start dev server at http://localhost:3000
npm run build     # Production build
npm run lint      # Run ESLint
```

## Workflow

```bash
# 1. Create a feature branch
git checkout -b feature/your-feature

# 2. Make changes, preview at localhost:3000

# 3. Push branch — Vercel creates a preview deploy automatically
git add .
git commit -m "description of change"
git push -u origin feature/your-feature

# 4. Open a PR on GitHub, review the Vercel preview URL

# 5. Merge to main — goes live at supraintegration.ai
```
