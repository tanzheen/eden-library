"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GENRES } from "@/lib/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Plus, X, Search, Loader2, Check, ImageOff } from "lucide-react";

interface AddBookFormProps {
  onBookAdded: () => void;
  userId: string | null;
  userName: string | null;
}

export function AddBookForm({ onBookAdded, userId, userName }: AddBookFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchingImage, setSearchingImage] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    author: "",
    description: "",
    cover_url: "",
    genre: "",
  });

  const router = useRouter();
  const supabase = createClient();

  const handleAddBookClick = () => {
    if (!userId) {
      router.push("/auth/login");
      return;
    }
    setIsOpen(true);
  };

  const searchCoverImage = async () => {
    if (!formData.title || !formData.author) {
      alert("Please enter title and author first");
      return;
    }

    setSearchingImage(true);

    try {
      const query = `${formData.title} ${formData.author} book cover`;
      const response = await fetch(`/api/search-image?q=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (data.imageUrl) {
        setImageLoading(true);
        setImageError(false);
        setFormData({ ...formData, cover_url: data.imageUrl });
      } else {
        alert("No cover image found. You can enter a URL manually.");
      }
    } catch (error) {
      console.error("Error searching for image:", error);
      alert("Failed to search for cover image. You can enter a URL manually.");
    } finally {
      setSearchingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.author) {
      alert("Please fill in title and author");
      return;
    }

    if (!userId || !userName) {
      alert("Please sign in to add books");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("books").insert([
      {
        title: formData.title,
        author: formData.author,
        description: formData.description || null,
        owner_name: userName,
        owner_id: userId,
        cover_url: formData.cover_url || null,
        genre: formData.genre ? parseInt(formData.genre) : null,
        status: true,
      },
    ]);

    setLoading(false);

    if (error) {
      alert("Failed to add book: " + error.message);
      return;
    }

    setFormData({
      title: "",
      author: "",
      description: "",
      cover_url: "",
      genre: "",
    });
    setIsOpen(false);
    onBookAdded();
  };

  if (!isOpen) {
    return (
      <Button onClick={handleAddBookClick} className="gap-2 bg-blue-600 hover:bg-blue-700">
        <Plus className="h-4 w-4" />
        Add a Book
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />
      <div className="relative bg-card border border-border rounded-2xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-xl">Add a Book to the Library</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Book Title *</Label>
              <Input
                id="title"
                placeholder="Enter book title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="author">Author *</Label>
              <Input
                id="author"
                placeholder="Enter author name"
                value={formData.author}
                onChange={(e) =>
                  setFormData({ ...formData, author: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="genre">Genre</Label>
              <select
                id="genre"
                value={formData.genre}
                onChange={(e) =>
                  setFormData({ ...formData, genre: e.target.value })
                }
                className="w-full h-9 px-3 py-1 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select a genre</option>
                {Object.entries(GENRES).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cover_url">Cover Image</Label>
              <div className="flex gap-2">
                <Input
                  id="cover_url"
                  placeholder="Cover image URL"
                  value={formData.cover_url}
                  onChange={(e) => {
                    setFormData({ ...formData, cover_url: e.target.value });
                    if (e.target.value) {
                      setImageLoading(true);
                      setImageError(false);
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={searchCoverImage}
                  disabled={searchingImage || !formData.title || !formData.author}
                  className="gap-2 shrink-0"
                >
                  {searchingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Find Cover
                </Button>
              </div>
              {formData.cover_url && (
                <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border">
                  <div className="flex gap-4">
                    <div className="relative h-40 w-28 bg-muted rounded-lg overflow-hidden shrink-0 border border-border">
                      {imageLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-muted">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      {imageError && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted text-muted-foreground">
                          <ImageOff className="h-8 w-8 mb-1" />
                          <span className="text-xs">Failed to load</span>
                        </div>
                      )}
                      <img
                        src={formData.cover_url}
                        alt="Cover preview"
                        className={`object-cover w-full h-full ${imageLoading || imageError ? "opacity-0" : "opacity-100"}`}
                        onLoad={() => {
                          setImageLoading(false);
                          setImageError(false);
                        }}
                        onError={() => {
                          setImageLoading(false);
                          setImageError(true);
                        }}
                      />
                      {!imageLoading && !imageError && (
                        <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div>
                        <p className="text-sm font-medium text-foreground">Cover Image Preview</p>
                        <p className="text-xs text-muted-foreground mt-1 break-all line-clamp-3">
                          {formData.cover_url}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFormData({ ...formData, cover_url: "" });
                          setImageError(false);
                        }}
                        className="w-fit text-destructive hover:text-destructive"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                placeholder="Brief description of the book"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full min-h-[100px] px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">
                <strong>Owner:</strong> {userName}
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {loading ? "Adding..." : "Add Book"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
