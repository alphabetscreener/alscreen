// Built-in fetch is available in Node 18+

const tmdbKey = "c1bd84da16d2e3ec683332c6b43e6fa3";

async function fetchTmdbDetails(query, year = null, type = 'Movie') {
    try {
        const isTv = type === 'TV Series' || type === 'Series';
        const endpoint = isTv ? 'tv' : 'movie';
        let url = `https://api.themoviedb.org/3/search/${endpoint}?api_key=${tmdbKey}&query=${encodeURIComponent(query)}`;

        if (year) {
            url += isTv ? `&first_air_date_year=${year}` : `&year=${year}`;
        }

        console.log(`Searching ${type} (${endpoint}) for "${query}" (Year: ${year})...`);
        console.log(`URL: ${url}`);

        const response = await fetch(url);
        if (!response.ok) {
            console.log("Response not OK");
            return null;
        }
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const top = data.results[0];
            console.log(`FOUND: ${top.title || top.name} (${top.release_date || top.first_air_date})`);
            return top;
        } else {
            console.log("NO RESULTS FOUND");
            return null;
        }
    } catch (e) {
        console.error("Error:", e);
        return null;
    }
}

async function run() {
    console.log("--- REPRODUCING ISSUE ---");
    // Scenario: User selects "The Penguin (2024) - TV Series"
    // Current logic in App.jsx parses this.

    const titleToSearch = "The Penguin (2024) - TV Series - Colin Farrell";

    // Current parsing logic in App.jsx (simplified)
    let searchTitle = titleToSearch;
    let searchYear = null;

    // Extract Context (Description) first
    const descMatch = titleToSearch.match(/-\s*(.+)$/);
    if (descMatch) {
        // Remove description
        const tempTitle = titleToSearch.replace(/-\s*(.+)$/, '').trim();
        const yearMatch = tempTitle.match(/(.+?)\s*\((\d{4})\)/);
        if (yearMatch) {
            searchTitle = yearMatch[1].trim();
            searchYear = yearMatch[2];
        } else {
            searchTitle = tempTitle;
        }
    }

    // Clean leading numbers
    searchTitle = searchTitle.replace(/^(\d+[\.)]|-|\*)\s*/, '');

    console.log(`PARSED: Title="${searchTitle}", Year="${searchYear}"`);

    // Current App.jsx logic: Tries Movie FIRST
    console.log("\n1. App.jsx Default Behavior (Movie First):");
    const movieResult = await fetchTmdbDetails(searchTitle, searchYear, 'Movie');

    if (movieResult && movieResult.title !== "The Penguin") {
        console.log(">>> BUG CONFIRMED: Found wrong movie instead of TV show.");
    }

    console.log("\n2. Desired Behavior (Respecting Type):");
    // If we knew it was a TV Series
    const tvResult = await fetchTmdbDetails(searchTitle, searchYear, 'TV Series');
}

run();
