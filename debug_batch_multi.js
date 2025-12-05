
const apiKey = "AIzaSyDUqB5TLMRxA8JGE9kcz0nysD1ujXgdNJU";
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

async function debugBatchMulti() {
    const titles = [
        "Harry Potter and the Sorcerer's Stone",
        "Harry Potter and the Prisoner of Azkaban"
    ];

    console.log(`Fetching batch of ${titles.length} failing titles with MULTI-URL prompt...`);

    // MULTI-URL PROMPT
    const prompt = `You are an image search assistant. 
      I need direct image URLs for the official movie posters of the following titles:
      ${JSON.stringify(titles)}
  
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
                    const urls = urlMap[title];
                    console.log(`\nTitle: ${title}`);
                    if (Array.isArray(urls)) {
                        for (const url of urls) {
                            console.log(`  Checking: ${url}`);
                            try {
                                const check = await fetch(url, { method: 'HEAD', referrerPolicy: "no-referrer" });
                                if (check.ok) {
                                    console.log(`  ✅ OK (${check.status})`);
                                } else {
                                    console.log(`  ❌ Broken (${check.status})`);
                                }
                            } catch (e) {
                                console.log(`  ❌ Error: ${e.message}`);
                            }
                        }
                    } else {
                        console.log("  Not an array:", urls);
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

debugBatchMulti();
