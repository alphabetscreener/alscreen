
const tmdbKey = "c1bd84da16d2e3ec683332c6b43e6fa3";

const fetchImagesUnified = async (rawString) => {
    console.log(`\n--- Processing: "${rawString}" ---`);

    // 1. Simple Parsing: Extract Title and Year
    // Ignore " - Movie", " - TV Series", descriptions, etc.
    // Just grab the first part "Title (Year)"
    const clean = rawString.replace(/\*\*/g, '').trim();

    // Regex: Capture Title and optional (Year)
    // Stop at the first " - " or end of string
    // This avoids the "Spider-Man" bug because we don't split on hyphens inside the title
    // We only split if there is a space-hyphen-space sequence, OR we just trust the year parens.

    let title = clean;
    let year = null;

    // Strategy: Look for the last occurrence of (YYYY)
    const yearMatch = clean.match(/\((\d{4})\)/g);
    if (yearMatch) {
        const lastYearBlock = yearMatch[yearMatch.length - 1]; // Use last one (e.g. "Title (2002)")
        year = lastYearBlock.match(/\d{4}/)[0];
        // Title is everything before that year block
        const yearIndex = clean.lastIndexOf(lastYearBlock);
        title = clean.substring(0, yearIndex).trim();
    } else {
        // No year? Just take everything before " - " or end
        const splitMatch = clean.match(/^(.*?)(?:\s+-\s+|$)/);
        if (splitMatch) title = splitMatch[1].trim();
    }

    console.log(`    Parsed: Title="${title}", Year="${year}"`);

    // 2. Unified Search (Movies + TV)
    const url = `https://api.themoviedb.org/3/search/multi?api_key=${tmdbKey}&query=${encodeURIComponent(title)}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            console.log("    ❌ No results found.");
            return;
        }

        // 3. Filter/Rank by Year (if we have one)
        let bestMatch = null;
        if (year) {
            bestMatch = data.results.find(r => {
                const releaseDate = r.release_date || r.first_air_date || '';
                return releaseDate.startsWith(year);
            });
        }

        // Fallback: If no year match (or no year provided), take the first result that has a poster
        if (!bestMatch) {
            bestMatch = data.results.find(r => r.poster_path);
        }

        if (bestMatch) {
            console.log(`    ✅ Match: "${bestMatch.title || bestMatch.name}" (${bestMatch.release_date || bestMatch.first_air_date}) [${bestMatch.media_type}]`);
            console.log(`       URL: https://image.tmdb.org/t/p/original${bestMatch.poster_path}`);
        } else {
            console.log("    ⚠️ Results found but no poster/match.");
        }

    } catch (e) {
        console.error("    Error:", e);
    }
};

async function runTest() {
    await fetchImagesUnified("Spider-Man (2002) - Movie");
    await fetchImagesUnified("Spider-Man: No Way Home (2021) - Movie");
    await fetchImagesUnified("Friends (1994) - TV Series");
    await fetchImagesUnified("The Office (2005) - TV Series"); // US Office
    await fetchImagesUnified("Mulan (1998) - Movie");
    await fetchImagesUnified("Mulan (2020) - Movie");
    await fetchImagesUnified("Avatar: The Last Airbender (2005) - Animated Series");
    await fetchImagesUnified("Unknown Title Without Year");
}

runTest();
