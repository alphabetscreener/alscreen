
// verify_fix.cjs
// Built-in fetch is available in Node 18+

const tmdbKey = "c1bd84da16d2e3ec683332c6b43e6fa3";

async function run() {
    const titleToSearch = "The Penguin (2024) - TV Series - Colin Farrell";
    console.log(`Input: "${titleToSearch}"`);

    // --- NEW LOGIC FROM APP.JSX (ROBUST SPLIT) ---
    let searchTitle = titleToSearch;
    let searchYear = null;
    let searchType = null;
    let searchContext = null;

    // 1. Detect Type
    if (titleToSearch.includes(' - TV Series')) searchType = 'TV Series';
    else if (titleToSearch.includes(' - Movie')) searchType = 'Movie';

    // 2. Clean Title & Year using Split (Safer than Regex)
    const parts = titleToSearch.split(' - ');
    if (parts.length > 0) {
        let rawTitle = parts[0].trim();

        // Remove leading numbers "1. The Penguin"
        rawTitle = rawTitle.replace(/^(\d+[\.)]|-|\*)\s*/, '');

        // Extract Year
        const yearMatch = rawTitle.match(/\((\d{4})\)/);
        if (yearMatch) {
            searchYear = yearMatch[1];
            searchTitle = rawTitle.replace(/\(\d{4}\)/, '').trim();
        } else {
            searchTitle = rawTitle;
        }

        // Context is everything after the title part
        if (parts.length > 1) {
            searchContext = parts.slice(1).join(' ');
        }
    }

    console.log(`Parsed: Title="${searchTitle}", Year="${searchYear}", Type="${searchType}"`);

    let tmdbResult = null;

    if (searchType) {
        console.log(`Prioritizing ${searchType} search...`);
        tmdbResult = await fetchTmdbDetails(searchTitle, searchYear, searchType, searchContext);
    }

    if (!tmdbResult && searchType !== 'Movie') {
        console.log("Fallback to Movie...");
        tmdbResult = await fetchTmdbDetails(searchTitle, searchYear, 'Movie', searchContext);
    }

    if (!tmdbResult && searchType !== 'TV Series') {
        console.log("Fallback to TV...");
        tmdbResult = await fetchTmdbDetails(searchTitle, searchYear, 'TV Series', searchContext);
    }

    if (tmdbResult) {
        console.log(`RESULT: ${tmdbResult.title || tmdbResult.name} (${tmdbResult.first_air_date || tmdbResult.release_date})`);
        if ((tmdbResult.title || tmdbResult.name) === "The Penguin") {
            console.log("SUCCESS: Found the correct show.");
        } else {
            console.log("FAILURE: Found wrong show.");
        }
    } else {
        console.log("FAILURE: No result found.");
    }
}

// Mock fetchTmdbDetails implementation for the script
async function fetchTmdbDetails(query, year = null, type = 'Movie') {
    try {
        const isTv = type === 'TV Series' || type === 'Series';
        const endpoint = isTv ? 'tv' : 'movie';
        let url = `https://api.themoviedb.org/3/search/${endpoint}?api_key=${tmdbKey}&query=${encodeURIComponent(query)}`;

        if (year) {
            url += isTv ? `&first_air_date_year=${year}` : `&year=${year}`;
        }

        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            return data.results[0];
        }
        return null;
    } catch (e) {
        console.error("Error:", e);
        return null;
    }
}

run();
