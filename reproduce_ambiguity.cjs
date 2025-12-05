
// reproduce_ambiguity.cjs
// Built-in fetch is available in Node 18+

const apiKey = "AIzaSyDXik_4NYLmyEpJMdURJXe71WdlBqG3cuo";
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

async function callGemini(title) {
    const prompt = `Analyze: "${title}".
 
         STEP 1: DISAMBIGUATION CHECK
           - Does this title refer to a FRANCHISE, SERIES, REBOOT, REMAKE, SHARED TITLE, or multiple DISTINCT movies / shows ?
             - BE OVER - CAUTIOUS.If there is an original and a reboot(e.g. "Rugrats" 1991 vs 2021), OR if multiple distinct franchises share the same name(e.g. "Avatar" - James Cameron vs Last Airbender), it IS AMBIGUOUS.
             - KIDS' FRANCHISES: If a cartoon series has theatrical movies (e.g. "Peppa Pig", "Paw Patrol", "SpongeBob"), return "AMBIGUOUS" and list the Series AND the Movies.
                    - IGNORE VIDEO GAMES.If the title is primarily a video game(e.g. "Elden Ring", "God of War") and has NO major movie / TV adaptation, return "AMBIGUOUS" with NO options(or just the movie / TV ones if they exist).
       - If YES, or if the title is vague, return EXACTLY: "AMBIGUOUS" followed by a numbered list of ALL relevant matches(Title + Year + Type).
                    - FILTER: The list MUST ONLY contain Movies or TV Series.Do NOT list Video Games.
                    - FORMAT: "1. Title (Year) - Type - Director/Star"
                    
                    STEP 2: IF UNIQUE(or specific enough)
         - Proceed immediately to analysis.
                    - Search specifically for LGBT themes, characters, or subplots to determine the ATP score.
                    
                    OUTPUT FORMAT(Strictly match these keys):
       Title: [Exact Title]
       Type: [Movie or TV Series]
       Year: [Year]
                    Content Rating: [Rating]
       IMDb: [Score]
                    IMDb ID: [tt...]
                    Rotten Tomatoes: [Percentage]
                    Rotten Tomatoes URL: [Full URL or N / A]
       ATP: [Score 0 - 10]
       Rationale: [Text]`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        const text = data.candidates[0].content.parts[0].text;
        console.log("--- AI RESPONSE ---");
        console.log(text.substring(0, 500) + "..."); // Print first 500 chars

        if (text.includes("AMBIGUOUS")) {
            console.log("\nRESULT: AMBIGUOUS (Correct)");
        } else {
            console.log("\nRESULT: DIRECT ANALYSIS (Incorrect for 'penguin')");
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

callGemini("penguin");
