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
- allow for EBOOK in the format? 
- if there are duplicated books, put it under one listing but the owner part can show something like "nic, chester and 2 others"

#### When adding a book
- For the image, use tavily image from brave to search for a cover image
- take the first image and then save it to supabase S3 or something in case the link disappear in the future
- take the answer from this search and also the answer from the "reading difficulty" into the LLM 
- For the search query, use the title and author of the book to search for the cover image URL and use the first one

// To install: npm i @tavily/core
const { tavily } = require('@tavily/core');
const client = tavily({ apiKey: "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" });
client.search("gentle & lowly by dane ortlund\n", {
    includeAnswer: "basic",
    searchDepth: "advanced",
    includeImages: true,
    includeRawContent: "text"
})
.then(console.log);

### Tab 3: AI library assistant 
- Use gemini api for the LLM 
- have access to vector database


### Recommendation system 
- require database to track clicks and orders 
- probably needs a cron job to filter and remove some clicks and orders from the database every week 
- take the average of the last 5 vectors and then find the nearest other vectors of the books 
- book tagging --> run LLM job to find tags like 
    - book difficulty (time commitment)
        Short & Casual
        Moderate Intermediate
        Dense or Academic
        Children
    - Purpose (suitable for)
        Study reference
        Devotional 
        Individual/Book club pick


- Reviews 
    - review 1-5 star + description

LLM for categorisation and tagging
- Google Gemini 3.1 Flash live --> Generate genre, book length, reading difficulty and purpose  --> Remember to track token usage 
    - Make it an AI agent to search queries about book length, reading difficulty and purpose before making a decision. (Ensure that this is async)

    LLM INPUT: text from best relevance query score,  answer text, reading difficulty query
    LLM OUTPUT: genre (standardised), difficulty tag, purpose tag, book length tag 


- If error, send message that AI assistant has ran out of credits, need to wait for reload
-  Gemini Embedding 2 --> Store embeddings and then use search to find books to recommend later on
    - Bible skills --> Dig deeper, preaching books
    - Church --> God's new community, Mission of the church, healthy church, ministry etc
    - Cross & ressurection --> The cross of Christ
    - Culture & Social issues --> Mental health, Atheistic movement etc
    - Evangelism & Missions --> Honest evangelism
    - Gender & Sexuality -->  LGBT, complementarism, Sex, marriage, dating
    - Gospel living --> Work & Rest, Money, Living in Godliness, Holiness etc 
    - Devotionals --> Books that are read 
    - Theology --> Prayer, Holy spirit, God's character

Store database of book
    - to get books from Etulip/Crossway since its easily accessible 
    - Stored books to contain 

LLM reccomender librarian 
    - Generate memories from top to bottom being the latest
    - Use tags to filter followed by FAISS search or something 
    - Recommend book 

Database: 
    - memories: Require a user to log in for the memories part
    - chatlogs: Track the chatlog between the user and the librarian bot
    - etulips: track what books have been bought from them before, prepare their descriptions and title, and their bought_status --> can port them over with their genre, tags and embeddings later on


  
