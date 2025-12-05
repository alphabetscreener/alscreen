
const tmdbKey = "c1bd84da16d2e3ec683332c6b43e6fa3";

const fetchTmdbImages = async (query, year = null, type = 'movie') => {
    try {
        let url = `https://api.themoviedb.org/3/search/${type === 'TV Series' ? 'tv' : 'movie'}?api_key=${tmdbKey}&query=${encodeURIComponent(query)}`;
        if (year) url += `&year=${year}`;

        console.log(`   [TMDB] Fetching: ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
            console.log(`   [TMDB] ❌ Error ${response.status}`);
            return [];
        }
        const data = await response.json();
        if (data.results && data.results.length > 0) {
            console.log(`   [TMDB] ✅ Found ${data.results.length} results. Top: ${data.results[0].title || data.results[0].name}`);
            return data.results.map(r => `https://image.tmdb.org/t/p/original${r.poster_path}`);
        } else {
            console.log(`   [TMDB] ⚠️ No results.`);
            return [];
        }
    } catch (e) {
        console.error("   [TMDB] Exception:", e);
        return [];
    }
};

const processOption = async (opt) => {
    console.log(`\nProcessing Option: "${opt}"`);

    // 1. Clean Markdown (Mock)
    const cleanOpt = opt.replace(/\*\*/g, '').trim();

    // 2. Extract Title
    let title = cleanOpt;
    const match = cleanOpt.match(/^(.*?)(?:\s*-\s*|$)/);
    if (match) title = match[1].trim();

    // 3. Extract Year
    let year = null;
    const yearMatch = title.match(/\((\d{4})\)/);
    if (yearMatch) {
        year = yearMatch[1];
        title = title.replace(/\(\d{4}\)/, '').trim();
    }

    // 4. Extract Type
    let type = 'Movie';
    if (cleanOpt.toLowerCase().includes('tv series') || cleanOpt.toLowerCase().includes('show')) {
        type = 'TV Series';
    }

    console.log(`   Parsed -> Title: "${title}", Year: ${year}, Type: "${type}"`);

    // 5. Fetch
    const tmdbType = (type === 'TV Series' || type === 'Series') ? 'TV Series' : 'movie';
    await fetchTmdbImages(title, year, tmdbType);
};

async function runTest() {
    const testCases = [
        "Mulan (1998) - Movie",
        "Mulan (2020) - Movie",
        "The Simpsons - TV Series",
        "Breaking Bad - TV Show",
        "Stranger Things (2016) - TV Series",
        "Avatar: The Last Airbender - Animated Series", // Might fail type check?
        "Friends (1994)", // Ambiguous type?
        "The Office (US) - TV Series",
        "Arcane (2021) - TV Series"
    ];

    for (const test of testCases) {
        await processOption(test);
    }
}

runTest();
