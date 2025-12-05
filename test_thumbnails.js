
const apiKey = "AIzaSyDXik_4NYLmyEpJMdURJXe71WdlBqG3cuo";
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

async function fetchThumbnail(title) {
    const prompt = `Find a direct image URL for the official theatrical movie poster or vertical TV show key art for "${title}". Prefer upload.wikimedia.org, m.media-amazon.com, or similar. Return ONLY the URL string.`;
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
            console.log(`Error fetching ${title}: ${response.status} ${response.statusText}`);
            return '';
        }
        const result = await response.json();
        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        console.log(`[${title}] Result:`, text);
        return text;
    } catch (e) {
        console.error(`Exception fetching ${title}:`, e);
        return '';
    }
}

async function run() {
    const titles = [
        "Harry Potter and the Sorcerer's Stone",
        "Harry Potter and the Chamber of Secrets",
        "Harry Potter and the Prisoner of Azkaban",
        "Harry Potter and the Goblet of Fire"
    ];

    for (const title of titles) {
        await fetchThumbnail(title);
    }
}

run();
