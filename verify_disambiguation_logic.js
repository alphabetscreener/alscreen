// Using global fetch (Node 18+)

const tmdbKey = "c1bd84da16d2e3ec683332c6b43e6fa3";

async function fetchTmdbImages(query, year = null, type = 'movie', matchContext = null) {
    try {
        console.log(`\nSearching for: "${query}" Year: ${year} Context: "${matchContext}"`);
        // 1. Search for the title
        let url = `https://api.themoviedb.org/3/search/${type === 'TV Series' ? 'tv' : 'movie'}?api_key=${tmdbKey}&query=${encodeURIComponent(query)}`;
        if (year) url += `&year=${year}`;

        let response = await fetch(url);
        if (!response.ok) return [];
        let data = await response.json();
        let results = data.results || [];

        console.log(`Initial results count: ${results.length}`);
        if (results.length > 0) {
            console.log(`Top result before sorting: ${results[0].title} (${results[0].release_date}) - ${results[0].overview.substring(0, 50)}...`);
        }

        // Context Matching Strategy
        if (matchContext && results.length > 0) {
            const contextWords = matchContext.toLowerCase().split(/\W+/).filter(w => w.length > 3);
            console.log(`Context words: ${contextWords.join(', ')}`);

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

            console.log("Top 3 Scored Results:");
            scoredResults.slice(0, 3).forEach(r => {
                console.log(`[Score: ${r.score}] ${r.title} (${r.release_date}) - ${r.overview.substring(0, 50)}...`);
            });

            // Determine threshold based on context length
            const threshold = contextWords.length >= 3 ? 1 : 0;
            console.log(`Threshold: > ${threshold}`);

            // If the top score is above threshold, use it
            if (scoredResults[0].score > threshold) {
                results = scoredResults;
            } else {
                console.log("No good match found with strict year (Score <= Threshold). Trying loose search...");
                // If year was strict and we found nothing relevant, try searching WITHOUT year
                if (year) {
                    const looseUrl = `https://api.themoviedb.org/3/search/${type === 'TV Series' ? 'tv' : 'movie'}?api_key=${tmdbKey}&query=${encodeURIComponent(query)}`;
                    const looseResp = await fetch(looseUrl);
                    if (looseResp.ok) {
                        const looseData = await looseResp.json();
                        if (looseData.results && looseData.results.length > 0) {
                            const looseScored = looseData.results.map(r => {
                                let score = 0;
                                const overview = (r.overview || '').toLowerCase();
                                contextWords.forEach(word => {
                                    if (overview.includes(word)) score++;
                                });
                                return { ...r, score };
                            });
                            looseScored.sort((a, b) => b.score - a.score);

                            console.log("Top 3 Loose Scored Results:");
                            looseScored.slice(0, 3).forEach(r => {
                                console.log(`[Score: ${r.score}] ${r.title} (${r.release_date}) - ${r.overview.substring(0, 50)}...`);
                            });

                            if (looseScored[0].score > 0) {
                                results = looseScored;
                            }
                        }
                    }
                }
            }
        }

        if (results && results.length > 0) {
            return results[0]; // Return the top result object for verification
        }
    } catch (e) {
        console.error("TMDB Fetch Error:", e);
    }
    return null;
}

async function run() {
    // Case 1: Simon Amstell's Benjamin
    const result1 = await fetchTmdbImages("Benjamin", "2018", "movie", "A rising star filmmaker is on the brink of premiering his difficult second film");
    console.log(`\nSELECTED: ${result1 ? result1.title + ' (' + result1.release_date + ') ID:' + result1.id : 'None'}`);

    // Case 2: Bob Saget's Benjamin
    const result2 = await fetchTmdbImages("Benjamin", "2019", "movie", "A family calls in an intervention for a drug addicted teen");
    console.log(`\nSELECTED: ${result2 ? result2.title + ' (' + result2.release_date + ') ID:' + result2.id : 'None'}`);

    // Case 3: Ambiguous year/Wrong year test
    const result3 = await fetchTmdbImages("Benjamin", "2018", "movie", "A family calls in an intervention for a drug addicted teen");
    console.log(`\nSELECTED: ${result3 ? result3.title + ' (' + result3.release_date + ') ID:' + result3.id : 'None'}`);
}

run();
