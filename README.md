# Eden Library

A community book exchange and lending app for discovering, sharing, and borrowing books — built for church communities. Tagline: *"Knowing Jesus through books."*

---

## Features

- **Book Catalogue** — Browse the full library, filter by genre, difficulty, purpose, or owner name, and search by keyword. Duplicate copies of the same title are grouped into a single listing showing all owners.
- **Add Books** — Authenticated users can add books to the catalogue. A cover image is fetched automatically via Tavily image search and stored in Supabase Storage. Book metadata (genre, difficulty, purpose, description, and embeddings) is generated asynchronously using Google Gemini.
- **Borrow & Return Flow** — Request to borrow an available book, owner approves the request, and the borrower returns it when done. Both parties receive Telegram notifications at each step.
- **Book Management** — A dedicated tab lets owners see their listed books, view pending borrow requests, approve or decline them, and delete listings. Borrowers can see their active and past loans.
- **AI Library Assistant** — Ask questions in natural language. The assistant uses Gemini with semantic (vector) search over the book catalogue to suggest relevant titles from the library.
- **Personalised Recommendations** — Based on a user's click history and borrow history, the app averages their interaction embeddings to surface books they are likely to enjoy.
- **Telegram Notifications** — Link a Telegram handle to your account. The app sends you a message when someone requests your book, and when your borrow request is approved.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js](https://nextjs.org) (App Router), React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS, `tailwind-merge`, `class-variance-authority` |
| UI primitives | [Radix UI](https://www.radix-ui.com), [Lucide](https://lucide.dev) icons |
| Theming | `next-themes` (light default) |
| Database & Auth | [Supabase](https://supabase.com) (Postgres, Auth, Storage) |
| AI / Embeddings | [Google Gemini](https://ai.google.dev) (`@google/genai`) — metadata generation, embeddings, recommendations |
| Web Search | [Tavily](https://tavily.com) — book cover image search and metadata research |
| Storage uploads | Supabase Storage SDK|
| Telegram bot | [grammy](https://grammy.dev) |

---

## Project Structure

```
eden-library/
├── app/
│   ├── page.tsx                   # Home — HeaderBanner + MainContent tabs
│   ├── layout.tsx                 # Root layout, theme provider, metadata
│   ├── api/
│   │   ├── add-book/              # POST — insert a book, upload cover, trigger metadata
│   │   ├── delete-book/           # POST — owner deletes an available book
│   │   ├── manage-books/          # GET  — owned books, pending orders, loans
│   │   ├── request-borrow/        # POST — create an order, notify owner via Telegram
│   │   ├── approve-order/         # POST — owner approves borrow, notify borrower
│   │   ├── return-order/          # POST — mark book returned
│   │   ├── search-image/          # GET  — Tavily cover image search
│   │   ├── generate-book-metadata/# POST — async Gemini metadata + embedding job
│   │   ├── ai-recommendations/    # POST — semantic search + Gemini answer text
│   │   ├── personalized-recommendations/ # GET — clicks/orders → similar books
│   │   ├── sign-cover-url/        # GET  — signed URL for a storage object
│   │   ├── sign-cover-urls/       # POST — batch signed URLs
│   │   ├── resolve-users/         # POST — resolve auth user display names
│   │   ├── tele-user/             # PUT  — save a Telegram handle
│   │   └── telegram-webhook/      # POST — Telegram bot webhook (sets chat_id)
│   └── auth/
│       ├── login/                 # Google OAuth sign-in page
│       ├── callback/              # OAuth code exchange
│       ├── confirm/               # Email OTP confirmation
│       ├── sign-up/               # Email sign-up (secondary flow)
│       └── ...                    # Forgot password, update password, error
├── components/
│   ├── main-content.tsx           # Tab shell: Catalogue / AI Assistant / Manage Books
│   ├── book-catalogue.tsx         # Catalogue list + filters + pagination
│   ├── book-card.tsx              # Catalogue card, click → details modal
│   ├── add-book-form.tsx          # Add-book form with cover search
│   ├── manage-books-tab.tsx       # Owned books, pending requests, loans
│   ├── ai-assistant-tab.tsx       # Chat interface wired to /api/ai-recommendations
│   ├── header-banner.tsx          # Hero header
│   ├── login-form.tsx             # Triggers Google OAuth
│   └── ui/                        # Shared Radix-based UI primitives
├── lib/
│   ├── supabase/
│   │   ├── client.ts              # Browser Supabase client
│   │   ├── server.ts              # Server Supabase client (cookies)
│   │   └── admin.ts               # Service-role admin client (bypasses RLS)
│   ├── books.ts                   # Book query helpers
│   ├── cover.ts                   # Cover upload helpers
│   ├── embeddings.ts              # Gemini embedding helpers
│   ├── prompts.ts                 # Gemini prompt templates
│   ├── telegram.ts                # grammy bot + sendTelegramMessage
│   └── types.ts                   # Shared TypeScript types
├── public/
│   └── header-wallpaper.webp
└── scripts/
    ├── test-image-search.ts
    └── test-metadata.ts
```

---

## Database Schema

There are no migration files in this repo. Create the following tables in your Supabase project.

### `books`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |
| `title` | `text` | |
| `author` | `text` | |
| `description` | `text` | AI-generated |
| `cover_url` | `text` | Storage path or public URL |
| `genre_tag` | `text` | e.g. `"Theology"`, `"Devotional"` |
| `difficulty` | `text` | e.g. `"Short & Casual"`, `"Dense or Academic"` |
| `purpose` | `text` | e.g. `"Devotional"`, `"Study Reference"` |
| `isbn` | `text` | |
| `embedding` | `vector(3072)` | Gemini `gemini-embedding-001` output (default dimensionality) |
| `status` | `boolean` | `true` = available |
| `owner_name` | `text` | Display name from Google |
| `owner_id` | `uuid` | References `auth.users` |
| `current_borrower` | `text` | Display name of active borrower |
| `current_borrower_id` | `uuid` | References `auth.users` |

### `orders`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |
| `borrowed_at` | `timestamptz` | Set on approval |
| `returned_at` | `timestamptz` | Set on return |
| `book_id` | `uuid` | References `books.id` |
| `owner_id` | `uuid` | |
| `borrower_id` | `uuid` | |
| `owner_name` | `text` | |
| `borrower_name` | `text` | |
| `status` | `text` | `requested` \| `borrowed` \| `returned` \| `cancelled` |
| `note` | `text` | Optional message from borrower |

### `tele_users`

| Column | Type | Notes |
|---|---|---|
| `owner_id` | `uuid` | References `auth.users` |
| `telehandle` | `text` | Telegram username |
| `chat_id` | `text` | Set by Telegram webhook |

### `clicks` (optional — enables personalised recommendations)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `clicked_at` | `timestamptz` | |
| `user_id` | `uuid` | |
| `book_id` | `uuid` | |
| `owner_id` | `uuid` | |
| `source` | `text` | Optional |

---

## Local Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd eden-library
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | Supabase anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key — used server-side only (never exposed to the browser) |
| `GEMINI_API_KEY` | ✅ | Google AI Studio API key |
| `TAVILY_API_KEY` | ✅ | Tavily search API key (cover images + metadata research) |
| `BOT_TOKEN` | Optional | Telegram bot token for borrow notifications |
| `VERCEL_URL` | Optional | Set automatically by Vercel; used for `metadataBase` |
| `SUPABASE_S3_ENDPOINT` | Optional | Supabase S3-compatible storage endpoint |
| `SUPABASE_S3_REGION` | Optional | e.g. `ap-southeast-1` |
| `SUPABASE_S3_ACCESS_KEY_ID` | Optional | S3 access key |
| `SUPABASE_S3_SECRET_ACCESS_KEY` | Optional | S3 secret key |
| `SUPABASE_S3_BUCKET` | Optional | Bucket name (default: `images`) |

### 3. Set up Supabase

1. Create a new [Supabase](https://supabase.com) project.
2. Create the tables described in the [Database Schema](#database-schema) section above.
3. Enable the `pgvector` extension (Database → Extensions → `vector`) for embedding storage and similarity search.
4. Configure Google OAuth in the Supabase Auth settings (Authentication → Providers → Google). Add your OAuth credentials and set the redirect URL to `<your-app-url>/auth/callback`.
5. Create a storage bucket named `images` (or the name set in `SUPABASE_S3_BUCKET`) and make it private.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |

---

## Authentication

Authentication is handled by **Supabase Auth with Google OAuth** as the primary sign-in method.

- `app/auth/login` — renders the sign-in button and triggers `signInWithOAuth`
- `app/auth/callback` — exchanges the OAuth code for a session cookie
- The browser client (`lib/supabase/client.ts`) and server client (`lib/supabase/server.ts`) handle session management via cookies using `@supabase/ssr`
- Privileged server-side operations (book inserts, order updates, resolving auth users) use the admin client in `lib/supabase/admin.ts` with `SUPABASE_SERVICE_ROLE_KEY`

---

## AI & Embeddings

When a book is added, an async background job (`/api/generate-book-metadata`) fires automatically:

1. **Tavily** searches the web for book metadata (description, reading level signals).
2. **Gemini** (`gemma-4-31b-it`) reads the search results and returns structured tags: `genre_tag`, `difficulty`, `purpose`, and `description`.
3. **Gemini Embeddings** (`gemini-embedding-001`) generates a 3072-dimension vector stored in `books.embedding`.

The AI Library Assistant (`/api/ai-recommendations`) performs cosine similarity over stored embeddings to find relevant books, then passes the results to Gemini to compose a natural-language answer.

Personalised recommendations (`/api/personalized-recommendations`) average the embeddings of books a user has clicked or borrowed to build a preference vector, then return the nearest available books.

---

## Telegram Notifications

1. Users link their Telegram handle in the app (the `tele-user` API endpoint saves it to `tele_users`).
2. The user messages the Telegram bot once; the webhook (`/api/telegram-webhook`) saves their `chat_id`.
3. From that point on, borrow requests and approvals trigger `sendTelegramMessage` via grammy.

To enable this, set `BOT_TOKEN` and register your webhook URL with Telegram:

```
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<your-app-url>/api/telegram-webhook
```

---

## Deployment

The app is designed to deploy on **Vercel**. Add all environment variables from the table above to your Vercel project settings.

`VERCEL_URL` is injected automatically by Vercel and used as the `metadataBase` for Open Graph tags.

> **Note:** `lib/telegram.ts` contains a hard-coded `APP_URL` pointing to the Vercel deployment URL. Update this value to match your own deployment URL.
