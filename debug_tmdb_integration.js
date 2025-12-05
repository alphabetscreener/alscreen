
const tmdbKey = "c1bd84da16d2e3ec683332c6b43e6fa3";

const fetchTmdbImages = async (query, year = null, type = 'movie') => {
    try {
        console.log(`[TMDB] Searching for: "${query}" (Year: ${year}, Type: ${type})`);
        // 1. Search for the title
        let url = `https://api.themoviedb.org/3/search/${type === 'TV Series' ? 'tv' : 'movie'}?api_key=${tmdbKey}&query=${encodeURIComponent(query)}`;
        if (year) url += `&year=${year}`; // TMDB supports year filtering

        const response = await fetch(url);
        if (!response.ok) {
            console.log(`[TMDB] ❌ API Error: ${response.status}`);
            return [];
        }
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            console.log(`[TMDB] ✅ Found ${data.results.length} results.`);
            // Return top 3 poster URLs
            return data.results
                .slice(0, 3)
                .filter(r => r.poster_path)
                .map(r => `https://image.tmdb.org/t/p/original${r.poster_path}`);
        } else {
            console.log(`[TMDB] ⚠️ No results found.`);
        }
    } catch (e) {
        console.error("[TMDB] Exception:", e);
    }
    return [];
};

const fetchThumbnail = async (title) => {
    console.log(`\n--- Processing: "${title}" ---`);
    // Extract year if present for better accuracy
    let cleanTitle = title;
    let year = null;
    const yearMatch = title.match(/\((\d{4})\)/);
    if (yearMatch) {
        year = yearMatch[1];
        cleanTitle = title.replace(/\(\d{4}\)/, '').trim();
    }
    console.log(`Clean Title: "${cleanTitle}", Year: ${year}`);

    // Try TMDB first (Fast & Accurate)
    const tmdbUrls = await fetchTmdbImages(cleanTitle, year);
    if (tmdbUrls.length > 0) {
        console.log("✅ TMDB Success! URLs:", tmdbUrls);
        return tmdbUrls;
    } else {
        console.log("❌ TMDB Failed. Would fall back to Gemini.");
        return null;
    }
};

async function runDebug() {
    await fetchThumbnail("Harry Potter and the Sorcerer's Stone (2001)");
    await fetchThumbnail("Mulan (1998)");
    await fetchThumbnail("Mulan (2020)");
    await fetchThumbnail("Unknown Obscure Movie (2025)");
}

runDebug();
