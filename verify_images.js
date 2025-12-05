
const apiKey = "AIzaSyDXik_4NYLmyEpJMdURJXe71WdlBqG3cuo";
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

async function verifyThumbnail(title) {
    // MATCHING THE NEW PROMPT
    const prompt = `Use the Google Search tool to find a working, direct image URL for the official movie poster or TV show key art for "${title}". 
    
    STRATEGY:
    1. Search specifically for: "site:upload.wikimedia.org ${title} poster" or "site:m.media-amazon.com ${title} poster".
    2. Select a URL that looks like a high-quality poster.
    3. Return ONLY the direct URL string. Do not guess.`;

    console.log(`\nTesting: "${title}"`);
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
        const imageUrl = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!imageUrl) {
            console.log("❌ No URL returned from API");
            return;
        }

        console.log(`   URL: ${imageUrl}`);

        try {
            const imgResponse = await fetch(imageUrl, {
                referrerPolicy: "no-referrer",
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            if (imgResponse.ok) {
                console.log(`✅ Image Accessible! (Status: ${imgResponse.status})`);
            } else {
                console.log(`❌ Image Blocked/Broken (Status: ${imgResponse.status})`);
            }
        } catch (err) {
            console.log(`❌ Network Error accessing image: ${err.message}`);
        }

    } catch (e) {
        console.error(`❌ Exception:`, e);
    }
}

async function run() {
    const titles = [
        "Harry Potter and the Sorcerer's Stone",
        "Harry Potter and the Prisoner of Azkaban" // This one failed before
    ];

    console.log("--- STARTING THUMBNAIL VERIFICATION (ROUND 4) ---");
    for (const title of titles) {
        await verifyThumbnail(title);
    }
    console.log("\n--- VERIFICATION COMPLETE ---");
}

run();
