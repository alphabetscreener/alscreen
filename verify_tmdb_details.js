// Using global fetch (Node 18+)

const tmdbKey = "c1bd84da16d2e3ec683332c6b43e6fa3";

// Mock of the function in App.jsx
const fetchTmdbDetails = async (query, year = null, type = 'Movie', matchContext = null) => {
    try {
        console.log(`\nFetching Details for: "${query}" Year: ${year} Context: "${matchContext}"`);
        const isTv = type === 'TV Series' || type === 'Series';
        const endpoint = isTv ? 'tv' : 'movie';
        let url = `https://api.themoviedb.org/3/search/${endpoint}?api_key=${tmdbKey}&query=${encodeURIComponent(query)}`;

        if (year) {
            url += isTv ? `&first_air_date_year=${year}` : `&year=${year}`;
        }

        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        let results = data.results || [];

        // Context Matching Strategy (Same as fetchTmdbImages)
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

            const threshold = contextWords.length >= 3 ? 1 : 0;
            if (scoredResults[0].score > threshold) {
                results = scoredResults;
            } else {
                console.log("Strict search weak match. Trying loose search...");
                // Loose search fallback
                if (year) {
                    const looseUrl = `https://api.themoviedb.org/3/search/${endpoint}?api_key=${tmdbKey}&query=${encodeURIComponent(query)}`;
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

                            if (looseScored[0].score > threshold) {
                                results = looseScored;
                            }
                        }
                    }
                }
            }
        }

        if (results && results.length > 0) {
            // Get the top result
            const topResult = results[0];
            console.log(`Selected Result: ${topResult.title} (${topResult.id})`);

            const detailRes = await fetch(`https://api.themoviedb.org/3/${endpoint}/${topResult.id}?api_key=${tmdbKey}&append_to_response=external_ids`);
            const detailData = await detailRes.json();

            const imdbId = detailData.imdb_id || (detailData.external_ids ? detailData.external_ids.imdb_id : null);
            console.log("TMDB Details Found:", { title: detailData.title, imdbId });

            return {
                title: detailData.title || detailData.name,
                year: (detailData.release_date || detailData.first_air_date || '').substring(0, 4),
                imdbId: imdbId,
                overview: detailData.overview,
                type: isTv ? 'TV Series' : 'Movie'
            };
        }
    } catch (e) {
        console.error("TMDB Details Error:", e);
    }
    return null;
};

async function run() {
    // Simulate the string from Gemini (Disambiguation Option)
    // Case 1: Simon Amstell
    const input1 = "1. Benjamin (2018) - Movie - Dir. Simon Amstell - A filmmaker struggles with his second film";
    console.log(`\n--- TEST CASE 1: ${input1} ---`);
    await processInput(input1);

    // Case 2: Bob Saget
    const input2 = "2. Benjamin (2018) - Movie - Dir. Bob Saget - A family calls in an intervention for a drug addicted teen";
    console.log(`\n--- TEST CASE 2: ${input2} ---`);
    await processInput(input2);
}

async function processInput(titleToSearch) {
    let searchTitle = titleToSearch;
    let searchYear = null;
    let searchContext = null;

    // Extract Context (Description) first
    const descMatch = titleToSearch.match(/-\s*(.+)$/);
    if (descMatch) {
        searchContext = descMatch[1];
        const tempTitle = titleToSearch.replace(/-\s*(.+)$/, '').trim();

        const yearMatch = tempTitle.match(/(.+?)\s*\((\d{4})\)/);
        if (yearMatch) {
            searchTitle = yearMatch[1].trim();
            searchYear = yearMatch[2];
        } else {
            searchTitle = tempTitle;
        }
    } else {
        const yearMatch = titleToSearch.match(/(.+?)\s*\((\d{4})\)/);
        if (yearMatch) {
            searchTitle = yearMatch[1].trim();
            searchYear = yearMatch[2];
        }
    }

    // Clean leading numbers/bullets
    searchTitle = searchTitle.replace(/^(\d+[\.)]|-|\*)\s*/, '');

    console.log(`Parsed -> Title: "${searchTitle}", Year: "${searchYear}", Context: "${searchContext}"`);

    await fetchTmdbDetails(searchTitle, searchYear, 'Movie', searchContext);
}

run();
