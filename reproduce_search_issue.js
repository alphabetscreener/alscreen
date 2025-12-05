


const apiKey = "AIzaSyDUqB5TLMRxA8JGE9kcz0nysD1ujXgdNJU";
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
const THEMATIC_TERM = "Explicit LGBTQ+ Thematic Presence";

const callGeminiApi = async (title) => {
    const prompt = `Analyze: "${title}". 
                   
                   STEP 1: DISAMBIGUATION CHECK
                   - Does this title refer to a FRANCHISE, SERIES, REBOOT, REMAKE, or multiple DISTINCT movies/shows?
                   - BE OVER-CAUTIOUS. If there is an original and a reboot (e.g. "Rugrats" 1991 vs 2021, "Charmed", "MacGyver"), it IS AMBIGUOUS.
                   - IGNORE VIDEO GAMES. If the title is primarily a video game (e.g. "Elden Ring", "God of War") and has NO major movie/TV adaptation, return "AMBIGUOUS" with NO options (or just the movie/TV ones if they exist).
                   - If YES, or if the title is vague, return EXACTLY: "AMBIGUOUS" followed by a numbered list of ALL relevant matches (Title + Year + Type).
                   - FILTER: The list MUST ONLY contain Movies or TV Series. Do NOT list Video Games.
                   
                   STEP 2: IF UNIQUE (or specific enough)
                   - Proceed immediately to analysis.
                   - Search specifically for LGBT themes, characters, or subplots to determine the ATP score.
                   
                   OUTPUT FORMAT (Strictly match these keys):
                   Title: [Exact Title]
                   Type: [Movie or TV Series]
                   Year: [Year]
                   Content Rating: [Rating]
                   IMDb: [Score]
                   IMDb ID: [tt...]
                   Rotten Tomatoes: [Percentage]
                   Rotten Tomatoes URL: [Full URL or N/A]
                   ATP: [Score 0-10]
                   Rationale: [Text]`;

    const sysMsg = `You are a media database assistant. SEARCH THE WEB for the title's plot, parental guide, and ratings.
               
               Step 1: DISAMBIGUATION / NOT FOUND. 
               - If the title is broad (e.g. "Goo", "Boys"), obscure, or lacks RELIABLE major database entries (IMDb/RT), return EXACTLY: "AMBIGUOUS" followed by a numbered list of likely popular matches.
               - STRICTLY EXCLUDE VIDEO GAMES, BOOKS, COMICS, and MUSIC. Only list Movies and TV Series.
               - Do NOT hallucinate data for obscure short films, YouTube videos, or unreleased content just to fill the fields. If you can't find reliable data for a major Western release, treat it as AMBIGUOUS.

               Step 2: ANALYSIS. Analyze against criteria: 'Alphabet Thematic Presence (ATP)' measures focus on ${THEMATIC_TERM}. 
               SCORING: 0-10 scale in 0.1 increments.
               0-3 Low: Background, incidental, or purely subtextual/ambiguous (e.g. 'coded' characters without explicit confirmation).
               4-6.7 Moderate: Recurring, confirmed, but non-graphic.
               7-10 High: Central, graphic, or main plot focus.
               
               CRITICAL SCORING RULES:
               1. CAP SCORE: If the theme is a SUBPLOT (even a major one like Vito in Sopranos), do NOT score above 7.5. (EXCEPTION: For TV-Y/TV-Y7/G/PG, the subplot cap is 8.7).
               2. 9-10 RESERVED: Only for shows where the theme is the CENTRAL PREMISE (e.g. Queer as Folk, Heartstopper).
               3. EXCLUDE: Purely speculative subtext or 'fan theories' should NOT score above 3.
               IMPORTANT: Purely speculative subtext or 'fan theories' should NOT score above 3.
               AGE RATING ADJUSTMENT: If the content is rated TV-Y, TV-Y7, G, or PG, you must grade stricter.
               Any openly LGBTQ+ character OR confirmed romantic relationship in a kids' show MUST be scored as High Risk (minimum 7).
               SATIRE EXCEPTION: If the content is purely satirical, stereotypical, or the character is the target of mockery (e.g. 'flamer' tropes used for comedy), score LOWER (Max 5).
               ATP DOES NOT SCORE race, religion, or general culture. 
               IMPORTANT: Search specifically for "Rotten Tomatoes" score, "Rotten Tomatoes URL", "Metacritic" score, "Metacritic URL" (Direct link to the specific page, NOT a search result), and "IMDb ID" (tt code).
               
               Output key-value pairs in this EXACT order:
               Title: [Exact Title]
               Type: [Movie or TV Series]
               Year: [Year]
               Content Rating: [Rating]
               IMDb: [Score]
               IMDb ID: [tt...]
               Rotten Tomatoes: [Percentage]
               Rotten Tomatoes URL: [Full URL or N/A]
               Metacritic: [Score 0-100]
               Metacritic URL: [Full URL or N/A]
               ATP: [Score 0-10]
               Season Scores: [S1:Score, S2:Score, ...] (If TV Series, comma separated)
               Rationale: [Text - VAGUE, SPOILER-FREE summary. Describe the *nature* of the content (e.g. 'Central romance', 'Background characters') without naming specific characters or revealing plot twists.]`;

    const tools = [{ "google_search": {} }];

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                systemInstruction: { parts: [{ text: sysMsg }] },
                tools: tools
            })
        });

        const result = await response.json();
        // console.log(JSON.stringify(result, null, 2));
        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log(`--- Result for "${title}" ---`);
        console.log(text);
    } catch (e) {
        console.error("Error:", e);
    }
};

// Test with titles that have video game counterparts
(async () => {
    await callGeminiApi("The Witcher");
    await callGeminiApi("Cyberpunk 2077");
    await callGeminiApi("Elden Ring");
    await callGeminiApi("Dark Souls");
    await callGeminiApi("Arcane");
})();
