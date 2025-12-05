
const tmdbKey = "c1bd84da16d2e3ec683332c6b43e6fa3";

const fetchThumbnail = async (rawTitle) => {
    console.log(`\n--- Processing: "${rawTitle}" ---`);
    try {
        // 1. Parse Title and Year
        let title = rawTitle;
        let year = null;

        // Extract year from last parentheses block (e.g. "Title (2002)")
        const yearMatch = rawTitle.match(/\((\d{4})\)/g);
        if (yearMatch) {
            const lastYearBlock = yearMatch[yearMatch.length - 1];
            year = lastYearBlock.match(/\d{4}/)[0];
            const yearIndex = rawTitle.lastIndexOf(lastYearBlock);
            title = rawTitle.substring(0, yearIndex).trim();
        } else {
            // Fallback: split on " - " if no year found
            const splitMatch = rawTitle.match(/^(.*?)(?:\s+-\s+|$)/);
            if (splitMatch) title = splitMatch[1].trim();
        }

        // Clean leading numbers/bullets (e.g. "1. Title")
        title = title.replace(/^(\d+[\.)]|-|\*)\s*/, '');

        console.log(`    Parsed: Title="${title}", Year="${year}"`);

        // 2. Unified Search (Movies + TV)
        const url = `https://api.themoviedb.org/3/search/multi?api_key=${tmdbKey}&query=${encodeURIComponent(title)}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.log("    ❌ API Error");
            return null;
        }
        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            console.log("    ❌ No results found");
            return null;
        }

        // 3. Filter/Rank by Year
        let bestMatch = null;
        if (year) {
            bestMatch = data.results.find(r => {
                const releaseDate = r.release_date || r.first_air_date || '';
                return releaseDate.startsWith(year);
            });
        }

        // 4. Fallback to first poster if no strict year match
        if (!bestMatch) {
            bestMatch = data.results.find(r => r.poster_path);
        }

        if (bestMatch && bestMatch.poster_path) {
            console.log(`    ✅ Match: "${bestMatch.title || bestMatch.name}" (${bestMatch.release_date || bestMatch.first_air_date})`);
            return [`https://image.tmdb.org/t/p/original${bestMatch.poster_path}`];
        } else {
            console.log("    ⚠️ Results found but no poster/match.");
        }

    } catch (e) {
        console.error("Image Fetch Error:", e);
    }
    return null;
};

async function runTest() {
    // Test cases based on user's new format: "1. Title (Year) - Type - Director/Star"
    await fetchThumbnail("1. Spider-Man (2002) - Movie - Sam Raimi");
    await fetchThumbnail("2. Spider-Man 2 (2004) - Movie - Sam Raimi");
    await fetchThumbnail("3. The Amazing Spider-Man (2012) - Movie - Marc Webb");
    await fetchThumbnail("4. Spider-Man: Into the Spider-Verse (2018) - Movie - Bob Persichetti");

    // Test cases with potential parsing issues
    await fetchThumbnail("5. Friends (1994) - TV Series - David Crane");
    await fetchThumbnail("6. Mulan (2020) - Movie - Niki Caro");

    // Test case without year (should fail or fallback)
    await fetchThumbnail("7. Unknown Movie - Movie");
}

runTest();
