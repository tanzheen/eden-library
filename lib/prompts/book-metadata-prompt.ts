/**
 * Prompt template for generating book metadata using Gemini LLM.
 *
 * This prompt takes search results from Tavily about a book and generates
 * standardized genre, difficulty, and purpose tags.
 */

export const BOOK_GENRES = [
  "Bible Skills",
  "Church",
  "Cross & Resurrection",
  "Culture & Social Issues",
  "Evangelism & Missions",
  "Gender & Sexuality",
  "Gospel Living",
  "Devotionals",
  "Theology",
] as const;

export const BOOK_DIFFICULTIES = [
  "Casual Reading",
  "Moderate Intermediate",
  "Dense or Academic",
  "Children",
] as const;

export const BOOK_PURPOSES = [
  "Study Reference",
  "Devotional/Reflection",
  "Individual/Book Club Pick",
] as const;

export type BookGenre = (typeof BOOK_GENRES)[number];
export type BookDifficulty = (typeof BOOK_DIFFICULTIES)[number];
export type BookPurpose = (typeof BOOK_PURPOSES)[number];

export interface BookMetadataResult {
  genre: BookGenre;
  difficulty: BookDifficulty;
  purpose: BookPurpose;
  description: string;
}

interface PromptInput {
  bookName: string;
  authorName: string;
  bookInfoAnswer: string;
  difficultyAnswer: string;
  searchContent: string;
}

/**
 * Generates the prompt for Gemini to classify a book's metadata.
 */
export function generateBookMetadataPrompt(input: PromptInput): string {
  return `You are a Christian book cataloguer. Based on the following search results about a book, classify it according to the specified categories.

BOOK INFORMATION:
- Title: "${input.bookName}"
- Author: "${input.authorName}"

SEARCH RESULTS:

Summary about the book:
${input.bookInfoAnswer}

Summary about reading difficulty:
${input.difficultyAnswer}

Detailed content:
${input.searchContent}

Classify this book into the following categories:

1. GENRE (choose exactly ONE):
   - "Bible Skills" - Books about studying scripture, digging deeper into the Bible, preaching books
   - "Church" - God's new community, mission of the church, healthy church, ministry
   - "Cross & Resurrection" - The cross of Christ, atonement, resurrection theology
   - "Culture & Social Issues" - Mental health, atheistic movement, engaging culture
   - "Evangelism & Missions" - Honest evangelism, sharing faith, missionary work
   - "Gender & Sexuality" - LGBT topics, complementarianism, sex, marriage, dating
   - "Gospel Living" - Work & rest, money, living in godliness, holiness, practical Christianity
   - "Devotionals" - Books meant for daily reading and reflection
   - "Theology" - Prayer, Holy Spirit, God's character, doctrinal studies

2. DIFFICULTY (choose exactly ONE based on reading difficulty search results) :
   - "Casual Reading" - Easy to read, accessible language, can be finished quickly
   - "Moderate Intermediate" - Requires some engagement, moderate length
   - "Dense or Academic" - Scholarly, requires significant study, theological depth
   - "Children" - Written specifically for children or young readers

3. PURPOSE (choose exactly ONE based on best use case):
   - "Study Reference" - Best used as a reference for study or research
   - "Devotional/Reflection" - Best for personal devotional reading and spiritual growth
   - "Individual/Book Club Pick" - Great for individual reading or group discussion

4. DESCRIPTION: Write a description paragraph about the book suitable for a library catalogue. Focus on what the book is about and who would benefit from reading it.

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{"genre":"<one of the genre options>","difficulty":"<one of the difficulty options>","purpose":"<one of the purpose options>","description":"<brief description>"}`;
}
