
const apiKey = "AIzaSyDUqB5TLMRxA8JGE9kcz0nysD1ujXgdNJU";
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

async function debugBatchRelaxed() {
    const titles = [
        "Harry Potter and the Sorcerer's Stone",
        "Harry Potter and the Prisoner of Azkaban",
        "Harry Potter and the Order of the Phoenix",
        "Harry Potter and the Deathly Hallows – Part 1"
    ];

    console.log(`Fetching batch of ${titles.length} failing titles with RELAXED prompt...`);

    // RELAXED PROMPT
    const prompt = `You are an image search assistant. 
      I need direct image URLs for the official movie posters of the following titles:
      ${JSON.stringify(titles)}
  
      For EACH title:
      1. Use the Google Search tool to find a valid, direct image URL.
      2. PREFER: themoviedb.org, wikimedia.org, rogerebert.com, metacritic.com, flixster.com.
      3. AVOID: pinterest, ebay, amazon (if hotlink blocked), etsy.
      4. Return the most reliable URL found.
      
      Return a valid JSON object string where the keys are the exact titles provided and the values are the image URLs.
      Example:
      \`\`\`json
      { "Title A": "http://...", "Title B": "http://..." }
      \`\`\`
      `;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                tools: [{ "google_search": {} }]
            })
        });

        if (!response.ok) {
            console.log(`❌ API Error: ${response.status}`);
            return;
        }

        const result = await response.json();
        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;

        console.log("\n--- RAW RESPONSE ---");
        console.log(text);
        console.log("--------------------\n");

        if (text) {
            const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
            const jsonStr = jsonMatch ? jsonMatch[1] : text;

            try {
                const urlMap = JSON.parse(jsonStr);
                console.log("--- URL CHECK ---");
                for (const title of titles) {
                    const url = urlMap[title];
                    console.log(`\nTitle: ${title}`);
                    console.log(`URL: ${url}`);
                    if (url) {
                        try {
                            const check = await fetch(url, { method: 'HEAD', referrerPolicy: "no-referrer" });
                            console.log(`Status: ${check.status} ${check.statusText}`);
                        } catch (e) {
                            console.log(`Check Failed: ${e.message}`);
                        }
                    } else {
                        console.log("URL is null/undefined");
                    }
                }
            } catch (e) {
                console.error("JSON Parse Error:", e);
            }
        }

    } catch (e) {
        console.error("Exception:", e);
    }
}

debugBatchRelaxed();
