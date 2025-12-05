
const apiKey = "AIzaSyDUqB5TLMRxA8JGE9kcz0nysD1ujXgdNJU";
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

async function debugRobustFlow() {
    const titlesToFetch = [
        "Harry Potter and the Sorcerer's Stone",
        "Harry Potter and the Chamber of Secrets"
    ];

    console.log("--- Simulating fetchBatchImages ---");
    console.log(`Fetching: ${JSON.stringify(titlesToFetch)}`);

    const prompt = `You are an image search assistant. 
      I need direct image URLs for the official movie posters of the following titles:
      ${JSON.stringify(titlesToFetch)}
  
      For EACH title:
      1. Use the Google Search tool to find 3 DISTINCT, valid image URLs from different reliable sources.
      2. Sources to use: themoviedb.org, wikimedia.org, rogerebert.com, metacritic.com, flixster.com, impawards.com.
      3. AVOID: pinterest, ebay, amazon, etsy.
      
      Return a valid JSON object string where the keys are the exact titles provided and the values are ARRAYS of strings (URLs).
      Example:
      \`\`\`json
      { 
        "Title A": ["http://url1...", "http://url2...", "http://url3..."], 
        "Title B": ["http://url1...", "http://url2..."] 
      }
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
            console.log(`❌ API Error: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.log(text);
            return;
        }

        const result = await response.json();
        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;

        console.log("\n--- Raw API Response ---");
        console.log(text);
        console.log("------------------------\n");

        if (text) {
            // Extract JSON from code block (Logic from App.jsx)
            const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
            const jsonStr = jsonMatch ? jsonMatch[1] : text;

            console.log("--- Extracted JSON String ---");
            console.log(jsonStr);

            try {
                const urlMap = JSON.parse(jsonStr);
                console.log("\n--- Parsed Object ---");
                console.log(JSON.stringify(urlMap, null, 2));

                // Verify structure
                for (const title of titlesToFetch) {
                    const urls = urlMap[title];
                    if (Array.isArray(urls)) {
                        console.log(`✅ ${title}: Got ${urls.length} URLs`);
                        // Check first URL
                        if (urls.length > 0) {
                            console.log(`   First URL: ${urls[0]}`);
                        }
                    } else {
                        console.log(`❌ ${title}: Not an array! Type: ${typeof urls}`);
                    }
                }

            } catch (e) {
                console.error("❌ JSON Parse Failed:", e.message);
            }
        } else {
            console.log("❌ No text in response");
        }

    } catch (e) {
        console.error("❌ Exception:", e);
    }
}

debugRobustFlow();
