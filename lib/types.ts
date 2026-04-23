export interface Book {
  id: number;
  created_at: string;
  title: string;
  author: string;
  description: string | null;
  cover_url: string | null;
  cover_url_downloaded?: string | null;
  genre_tag: string | null;
  difficulty: string | null;
  purpose: string | null;
  isbn: string | null;
  embedding: number[] | null;
  status: boolean;
  updated_at: string;
  owner_name: string | null;
  owner_id: string | null;
  current_borrower?: string | null;
  current_borrower_id?: string | null;
}

export interface BookInteraction {
  id: number;
  user_id: string;
  book_id: number;
  interaction_type: "click" | "borrow" | "return";
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

export const GENRES: Record<number, string> = {
  1: "Theology",
  2: "Christian Living",
  3: "Biography",
  4: "Prayer",
  5: "Fiction",
  6: "History",
  7: "Devotional",
  8: "Children",
  9: "Bible Study",
  10: "Apologetics",
  11: "Marriage & Family",
  12: "Leadership",
  13: "Missions",
  14: "Worship",
  15: "Other",
};

export function getGenreName(genreId: number | null): string {
  if (genreId === null) return "Unknown";
  return GENRES[genreId] || "Other";
}

export function getGenreId(genreName: string): number | null {
  const entry = Object.entries(GENRES).find(([, name]) => name === genreName);
  return entry ? parseInt(entry[0]) : null;
}

// New categorization system for AI-generated metadata
export const GENRE_TAGS = [
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

export const DIFFICULTY_OPTIONS = [
  "Casual Reading",
  "Moderate Intermediate",
  "Dense or Academic",
  "Children",
] as const;

export const PURPOSE_OPTIONS = [
  "Study Reference",
  "Devotional/Reflection",
  "Individual/Book Club Pick",
] as const;

export type GenreTag = (typeof GENRE_TAGS)[number];
export type Difficulty = (typeof DIFFICULTY_OPTIONS)[number];
export type Purpose = (typeof PURPOSE_OPTIONS)[number];
