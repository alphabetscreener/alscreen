
const apiKey = "AIzaSyDXik_4NYLmyEpJMdURJXe71WdlBqG3cuo";
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

async function fetchThumbnail(title) {
    const prompt = `Use the Google Search tool to find a working, direct image URL for the official movie poster or TV show key art for "${title}". 
    Search for "movie poster ${title} wikimedia" or "movie poster ${title} tmdb".
    Return ONLY the direct URL string found by the tool. Do not guess.`;

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
            return { title, error: `API Error ${response.status}` };
        }

        const result = await response.json();
        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        return { title, url: text };
    } catch (e) {
        return { title, error: `Exception: ${e.message}` };
    }
}

async function checkUrl(url) {
    if (!url) return { status: 'N/A', ok: false };
    try {
        const response = await fetch(url, {
            referrerPolicy: "no-referrer",
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        return { status: response.status, ok: response.ok, type: response.headers.get('content-type') };
    } catch (e) {
        return { status: 'Network Error', ok: false, error: e.message };
    }
}

async function run() {
    const titles = [
        "Harry Potter and the Sorcerer's Stone",
        "Harry Potter and the Chamber of Secrets",
        "Harry Potter and the Prisoner of Azkaban",
        "Harry Potter and the Goblet of Fire",
        "Harry Potter and the Order of the Phoenix",
        "Harry Potter and the Half-Blood Prince",
        "Harry Potter and the Deathly Hallows – Part 1",
        "Harry Potter and the Deathly Hallows – Part 2"
    ];

    console.log("--- STARTING PARALLEL FETCH TEST ---");

    // Simulate the parallel behavior of App.jsx
    const promises = titles.map(async (title) => {
        const result = await fetchThumbnail(title);
        if (result.url) {
            const check = await checkUrl(result.url);
            return { ...result, check };
        }
        return result;
    });

    const results = await Promise.all(promises);

    results.forEach(r => {
        console.log(`\nTitle: ${r.title}`);
        if (r.error) {
            console.log(`❌ Fetch Error: ${r.error}`);
        } else {
            console.log(`   URL: ${r.url}`);
            if (r.check.ok) {
                console.log(`✅ Image OK (${r.check.status})`);
            } else {
                console.log(`❌ Image Broken (${r.check.status})`);
            }
        }
    });
}

run();
