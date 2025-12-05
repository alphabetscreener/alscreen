
// Using built-in fetch

const apiKey = "AIzaSyDXik_4NYLmyEpJMdURJXe71WdlBqG3cuo";
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

const preResolvedData = {
    title: "PAW Patrol: The Mighty Movie",
    year: "2023",
    imdbId: "tt15837338"
};

const analysisPrompt = `Analyze the movie/show "${preResolvedData.title}" (${preResolvedData.year}).
                   
                   MANDATORY SEARCH STEPS:
                   1. Search for "Parental Guide ${preResolvedData.title}".
                   2. Search for "LGBT characters in ${preResolvedData.title}".
                   3. Search for "gay storyline in ${preResolvedData.title}".
                   4. Search for "romance plot ${preResolvedData.title}".
                   
                   IMDb ID Reference: ${preResolvedData.imdbId || 'N/A'} (Use for identification, but analyze content based on Title search results).
                   
                   OUTPUT FORMAT (Strictly match these keys):
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
                   Rationale: [Text]`;

async function testApi() {
    console.log("Sending Prompt:\n", analysisPrompt);
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: analysisPrompt }] }],
                tools: [{ "google_search": {} }]
            })
        });

        const data = await response.json();
        console.log("Response Status:", response.status);

        if (data.candidates && data.candidates.length > 0) {
            const text = data.candidates[0].content.parts[0].text;
            console.log("\n--- AI RESPONSE ---\n");
            console.log(text);
            console.log("\n-------------------\n");
        } else {
            console.log("No candidates returned.", JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

testApi();
