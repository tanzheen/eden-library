# Eden Library

This document captures the current product direction, feature ideas, and technical notes for the library app.

## Authentication

- Sign in with Google.
- `owner_name` for a book should match the name of the currently signed-in Google account.
- `owner_id` should be managed by Supabase.

## Appearance

- Support both light mode and dark mode.
- Default theme should be light mode.

## App Structure

### Tab 1: Home

- Show the latest books that were added.
- Show books the current user might like.
- Personalized recommendations will require tracking:
  - books clicked by the user
  - books borrowed by the user

### Tab 2: Book Catalogue

- Add a filter bar that can search by:
  - BM25 keyword search
  - owner name
  - genre
- Retrieve genres from the SSBC book list.
- Support ebook entries if needed.
- If duplicate books exist, show them under one listing.
- The ownership display can read something like: `"nic, chester and 2 others"`.
- The catalogue card should show:
  - book title
  - owner
  - difficulty tag
  - purpose tag
- Do not show date or description in the catalogue view.
- Do not use a separate "View Details" button.
- The entire book card should be clickable and act as the entry point into the book page.

### Book Cover Display

- Do not crop the book cover incorrectly.
- Show the full height of the book cover.
- Prioritize displaying the entire cover rather than trimming the top or bottom.

### Book Details Page

- After clicking a book, open a details page styled similarly to the Google Books layout.
- The book cover should appear on the left and be smaller than in the catalogue hero layout.
- The right side should show:
  - title
  - author
  - owner or owners
  - tags
- Show the description below the main metadata area.
- The layout should make the metadata easy to scan before the user reads the description.

### When Adding a Book

- Search for a cover image using the title and author.
- Use Tavily image search via Brave search results.
- Take the first suitable image result.
- Store the cover image in Supabase Storage so the app does not depend on an external URL staying active.
- Feed both the search answer and the reading-difficulty result into the LLM.

Example setup:

```js
const { tavily } = require("@tavily/core");

const client = tavily({ apiKey: process.env.TAVILY_API_KEY });

client
  .search("Gentle and Lowly by Dane Ortlund", {
    includeAnswer: "basic",
    searchDepth: "advanced",
    includeImages: true,
    includeRawContent: "text",
  })
  .then(console.log);
```

Install:

```bash
npm i @tavily/core
```

### Tab 3: AI Library Assistant

- Use the Gemini API as the LLM.
- Give the assistant access to a vector database.

## Recommendation System

- Track user clicks and borrow history.
- Run a weekly cron job to remove or downweight older interaction data.
- Build user preference vectors from the average of the last 5 relevant vectors.
- Find nearby book vectors for recommendations.

### Book Tagging

Use an LLM job to generate tags such as:

- Reading difficulty / time commitment:
  - Short & Casual
  - Moderate Intermediate
  - Dense or Academic
  - Children
- Purpose / suitability:
  - Study Reference
  - Devotional
  - Individual Reading
  - Book Club Pick

## Reviews

- Support 1 to 5 star ratings.
- Support written review descriptions.

## LLM Categorization and Tagging

- Use Google Gemini 3.1 Flash Live to generate:
  - genre
  - book length
  - reading difficulty
  - purpose
- Track token usage.
- Make this an async AI agent workflow.
- Before deciding, the agent should search for book-length, reading-difficulty, and purpose signals.

### LLM Input

- text from the best relevance query score
- answer text
- reading difficulty query result

### LLM Output

- standardized genre
- difficulty tag
- purpose tag
- book length tag

### Failure Handling

- If the AI service fails due to credit limits, show a message that the assistant has run out of credits and the user needs to wait for reload.

## Embeddings

- Use Gemini Embedding 2.
- Store book embeddings for future recommendation and similarity search.

Possible topic clusters:

- Bible skills
- Church
- Cross & resurrection
- Culture & social issues
- Evangelism & missions
- Gender & sexuality
- Gospel living
- Devotionals
- Theology

Example titles and topics noted so far:

- Bible skills: preaching books
- Church: *God's New Community*, *The Mission of the Church*, healthy church, ministry
- Cross & resurrection: *The Cross of Christ*
- Culture & social issues: mental health, atheistic movement
- Evangelism & missions: *Honest Evangelism*
- Gender & sexuality: LGBT, complementarianism, sex, marriage, dating
- Gospel living: work and rest, money, godliness, holiness
- Devotionals: books intended for regular devotional reading
- Theology: prayer, Holy Spirit, God's character

## Book Data

- Consider sourcing accessible book data from Etulip and Crossway.
- Stored book records should include the fields needed for metadata, tags, and embeddings.

## AI Librarian

- Look at clicks and orders table to see what type of books the person reads
- FAISS-style similarity search.
- Return book recommendations based on both memory and semantic similarity.

## Database Notes

- `memories`: requires user login
- `chatlogs`: stores conversations between the user and the librarian bot
- `etulips`: stores books previously bought from Etulip, including:
  - descriptions
  - titles
  - purchase status
  - later-added genre, tags, and embeddings
NOTE: embeddings are currently not working that well

## Borrowing mechanism 
- Send an email to the owner's gmail registered with google. Send with a personal note and name
- Telegram feature later on

## Display mechanism 
- The crop of the book cover is wrong 
- show the whole height of the book
- Book cover should be smaller and shown on the left , right side should be name, author, owner, tags and then description below
- check on phone too 

## Future iterations 
- need a "profiles" table to store whether the user is approved
- need a "loans" table to track the history of who order from who


## Book management 
- manage your own books tab
- being able to see your own books and delete them from the database if you want to remove them
