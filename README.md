This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## DynamoDB (optional)

This app can load/save agents to AWS DynamoDB via Next.js API routes.

1. Create a DynamoDB table with partition key `PK` (string) and sort key `SK` (string).
2. Set environment variables (e.g. in `.env.local`):

```bash
AWS_REGION=us-east-1
DDB_TABLE=AgentExperiences
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

Item shapes used:
- Agent profile: `PK=AGENT#{id}`, `SK=PROFILE`
- Experience: `PK=AGENT#{id}`, `SK=EXPERIENCE#{createdAt}`

## LinkedIn login (optional)

Write actions (submitting agents/experiences) require a LinkedIn login via OAuth.

Set these environment variables (e.g. in `.env.local`):

```bash
AUTH_SECRET=... # random long string used to sign the session cookie
# Optional: logs LinkedIn info during OAuth.
# - "true": safe logs (field presence + session creation)
# - "full": logs raw LinkedIn JSON payloads (may include PII)
AUTH_DEBUG=true
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
# Defaults to: "openid profile email" (matches LinkedIn's current OAuth scopes UI)
# Set this only if you're using legacy LinkedIn scopes like "r_liteprofile r_emailaddress".
LINKEDIN_SCOPES="openid profile email"
# Optional (recommended): let the app derive the full callback URL from the current request.
LINKEDIN_REDIRECT_URI=auto
# Or pin an explicit callback URL (must match LinkedIn "Authorized redirect URLs" exactly):
# LINKEDIN_REDIRECT_URI=http://localhost:3000/api/auth/linkedin/callback
# LINKEDIN_REDIRECT_URI=https://your-domain.com/api/auth/linkedin/callback
```

LinkedIn is strict about `redirect_uri` matching exactly. In the LinkedIn app settings, add the callback URL you intend to use:
- Local dev: `http://localhost:3000/api/auth/linkedin/callback` (or register `127.0.0.1` if you browse via that host)
- Production: `https://your-domain.com/api/auth/linkedin/callback`

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
