## Login auth
- Use google account 
- the owner_name of any book will be the name of the google account that is currently logged in 
- the owner_id should be settled by supabase

## Appearance

## Allow for both light mode and dark mode (default would be light mode)

### Tab 1: Home
- Show the latest books that were added
- Show books that the currently signed in person might like (This will require the people to first borrow or click into a few books)
- In this case, I would need a database tracking clicks and borrows of each person

### Tab 2: Catalogue of books 
- allow a filter bar, that can search by bm25 keyword searching (need to check if supabase have), owner name, and also genre (retrieve genres from SSBC booklist) 


#### When adding a book
- For the image, Use search image from brave to search for a cover image
- For the search query, use the title and author of the book to search for the cover image URL and use the first one


### Tab 3: AI library assistant 
- Use gemini api for the LLM 
- have access to vector database
- have access to etulip website to scrape their books




