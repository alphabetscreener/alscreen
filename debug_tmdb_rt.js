
const tmdbKey = "c1bd84da16d2e3ec683332c6b43e6fa3";

async function checkExternalIds(query, type) {
    console.log(`Searching for ${type}: ${query}...`);
    const endpoint = type === 'tv' ? 'tv' : 'movie';
    const searchUrl = `https://api.themoviedb.org/3/search/${endpoint}?api_key=${tmdbKey}&query=${encodeURIComponent(query)}`;

    try {
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();

        if (searchData.results && searchData.results.length > 0) {
            const id = searchData.results[0].id;
            console.log(`Found ID: ${id} for ${searchData.results[0].name || searchData.results[0].title}`);

            const detailsUrl = `https://api.themoviedb.org/3/${endpoint}/${id}?api_key=${tmdbKey}&append_to_response=external_ids`;
            const detailsRes = await fetch(detailsUrl);
            const detailsData = await detailsRes.json();

            console.log("External IDs:", detailsData.external_ids);
        } else {
            console.log("No results found.");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

async function run() {
    await checkExternalIds("The Matrix", "movie");
    await checkExternalIds("Breaking Bad", "tv");
}

run();
