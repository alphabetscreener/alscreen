
const apiKey = "AIzaSyDUqB5TLMRxA8JGE9kcz0nysD1ujXgdNJU";
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

async function checkApi() {
    console.log("Checking API Status...");
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Hello, are you working?" }] }]
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log("✅ API is responding (200 OK)");
            console.log("Response:", data?.candidates?.[0]?.content?.parts?.[0]?.text);
        } else {
            console.log(`❌ API Error: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.log("Error Body:", text);
        }
    } catch (e) {
        console.error("❌ Network Exception:", e);
    }
}

checkApi();
