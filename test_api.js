
const apiKey = "AIzaSyDXik_4NYLmyEpJMdURJXe71WdlBqG3cuo";
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

async function testText() {
    console.log("Testing Text Analysis...");
    const prompt = "Analyze the movie The Matrix.";
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
            console.error("Text Analysis Failed:", response.status, response.statusText);
            const text = await response.text();
            console.error(text);
        } else {
            console.log("Text Analysis Success");
            const data = await response.json();
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error("Text Analysis Error:", e);
    }
}

async function testImage() {
    console.log("\nTesting Image Search...");
    const prompt = 'Find a direct image URL for the official theatrical movie poster or vertical TV show key art for "The Matrix". Prefer upload.wikimedia.org, m.media-amazon.com, or similar. Return ONLY the URL string.';
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
            console.error("Image Search Failed:", response.status, response.statusText);
            const text = await response.text();
            console.error(text);
        } else {
            console.log("Image Search Success");
            const data = await response.json();
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error("Image Search Error:", e);
    }
}

async function run() {
    await testText();
    await testImage();
}

run();
