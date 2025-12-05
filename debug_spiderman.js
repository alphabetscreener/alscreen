
const tmdbKey = "c1bd84da16d2e3ec683332c6b43e6fa3";

const fetchTmdbImages = async (query, year = null, type = 'movie', matchContext = null) => {
    try {
        console.log(`\n--- Fetching: "${query}" (Year: ${year}, Type: ${type}) ---`);
        console.log(`    Context: "${matchContext}"`);

        // 1. Search for the title
        let url = `https://api.themoviedb.org/3/search/${type === 'TV Series' ? 'tv' : 'movie'}?api_key=${tmdbKey}&query=${encodeURIComponent(query)}`;
        if (year) {
            url += type === 'TV Series' ? `&first_air_date_year=${year}` : `&year=${year}`;
        }

        let response = await fetch(url);
        if (!response.ok) {
            console.log("    ❌ Strict Search Failed");
            return [];
        }
        let data = await response.json();
        let results = data.results || [];

        console.log(`    Strict Results: ${results.length}`);
        if (results.length > 0) console.log(`    Top Strict: ${results[0].title} (${results[0].release_date})`);

        // Context Matching Strategy
        if (matchContext && results.length > 0) {
            const contextWords = matchContext.toLowerCase().split(/\W+/).filter(w => w.length > 3);
            console.log(`    Context Words: ${JSON.stringify(contextWords)}`);

            // Score each result
            const scoredResults = results.map(r => {
                let score = 0;
                const overview = (r.overview || '').toLowerCase();
                contextWords.forEach(word => {
                    if (overview.includes(word)) score++;
                });
                return { ...r, score };
            });

            // Sort by score descending
            scoredResults.sort((a, b) => b.score - a.score);
            console.log(`    Top Scored Strict: ${scoredResults[0].title} (Score: ${scoredResults[0].score})`);

            // Determine threshold based on context length
            const threshold = contextWords.length >= 3 ? 1 : 0;
            console.log(`    Threshold: ${threshold}`);

            // If the top score is above threshold, use it
            if (scoredResults[0].score > threshold) {
                console.log("    ✅ Strict Score > Threshold. Using Scored Results.");
                results = scoredResults;
            } else {
                console.log("    ⚠️ Strict Score <= Threshold. Trying Loose Search...");
                // If year was strict and we found nothing relevant, try searching WITHOUT year
                if (year) {
                    const looseUrl = `https://api.themoviedb.org/3/search/${type === 'TV Series' ? 'tv' : 'movie'}?api_key=${tmdbKey}&query=${encodeURIComponent(query)}`;
                    const looseResp = await fetch(looseUrl);
                    if (looseResp.ok) {
                        const looseData = await looseResp.json();
                        if (looseData.results && looseData.results.length > 0) {
                            console.log(`    Loose Results: ${looseData.results.length}`);
                            const looseScored = looseData.results.map(r => {
                                let score = 0;
                                const overview = (r.overview || '').toLowerCase();
                                contextWords.forEach(word => {
                                    if (overview.includes(word)) score++;
                                });
                                return { ...r, score };
                            });
                            looseScored.sort((a, b) => b.score - a.score);
                            console.log(`    Top Scored Loose: ${looseScored[0].title} (Score: ${looseScored[0].score})`);

                            if (looseScored[0].score > 0) {
                                console.log("    ✅ Loose Score > 0. REPLACING results with Loose Results.");
                                results = looseScored;
                            } else {
                                console.log("    ❌ Loose Score is 0. Keeping Strict Results.");
                            }
                        }
                    }
                }
            }
        }

        if (results && results.length > 0) {
            console.log(`    FINAL RESULT: ${results[0].title} (${results[0].release_date})`);
            return results.map(r => `https://image.tmdb.org/t/p/original${r.poster_path}`);
        }
    } catch (e) {
        console.error("TMDB Fetch Error:", e);
    }
    return [];
};

const processOption = async (opt) => {
    const cleanOpt = opt.replace(/\*\*/g, '').trim();
    let title = cleanOpt;
    const match = cleanOpt.match(/^(.*?)(?:\s*-\s*|$)/);
    if (match) title = match[1].trim();

    let year = null;
    const yearMatch = title.match(/\((\d{4})\)/);
    if (yearMatch) {
        year = yearMatch[1];
        title = title.replace(/\(\d{4}\)/, '').trim();
    }

    let type = 'Movie';
    const lowerOpt = cleanOpt.toLowerCase();
    if (lowerOpt.includes('tv series') || lowerOpt.includes('show')) {
        type = 'TV Series';
    }

    let description = null;
    const descMatch = cleanOpt.match(/-\s*(.+)$/);
    if (descMatch) description = descMatch[1];

    await fetchTmdbImages(title, year, type, description);
};

async function runTest() {
    await processOption("Spider-Man (2002) - Movie");
    await processOption("Spider-Man 2 (2004) - Movie");
    await processOption("Spider-Man: Homecoming (2017) - Movie");
    await processOption("Spider-Man: Far From Home (2019) - Movie");
}

runTest();
