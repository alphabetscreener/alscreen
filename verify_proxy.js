
const apiKey = "AIzaSyDXik_4NYLmyEpJMdURJXe71WdlBqG3cuo";
// Note: Port 5173 is the default Vite port
const proxyUrl = `http://localhost:5173/api/gemini/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

async function testProxy() {
    console.log("Testing Proxy URL:", proxyUrl);
    const prompt = "Analyze the movie The Matrix.";
    try {
        const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                tools: [{ "google_search": {} }]
            })
        });

        console.log("Status:", response.status);
        if (!response.ok) {
            console.error("Proxy Request Failed:", response.statusText);
            const text = await response.text();
            console.error("Response Body:", text);
        } else {
            console.log("Proxy Request Success!");
            const data = await response.json();
            console.log("Data received via proxy.");
        }
    } catch (e) {
        console.error("Proxy Test Error:", e);
    }
}

testProxy();
