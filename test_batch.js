
const apiKey = "AIzaSyDUqB5TLMRxA8JGE9kcz0nysD1ujXgdNJU";
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

async function fetchBatchThumbnails(titles) {
    console.log(`Fetching batch of ${titles.length} titles...`);
    const prompt = `You are an image search assistant. 
    I need direct image URLs for the official movie posters of the following titles:
    ${JSON.stringify(titles)}

    For EACH title, use the Google Search tool to find a valid, direct image URL (prefer tmdb.org or wikimedia.org).
    
    Return a valid JSON object string where the keys are the exact titles provided and the values are the image URLs.
    Example:
    \`\`\`json
    { "Title A": "http://...", "Title B": "http://..." }
    \`\`\`
    If you can't find a URL for a title, use null.`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                tools: [{ "google_search": {} }]
                // Removed generationConfig
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
        console.log("Response:", text);
    } catch (e) {
        console.error("Exception:", e);
    }
}

async function run() {
    const titles = [
        "Harry Potter and the Sorcerer's Stone",
        "Harry Potter and the Chamber of Secrets",
        "Harry Potter and the Prisoner of Azkaban",
        "Harry Potter and the Goblet of Fire"
    ];

    await fetchBatchThumbnails(titles);
}

run();
