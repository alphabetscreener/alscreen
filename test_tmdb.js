const tmdbKey = "c1bd84da16d2e3ec683332c6b43e6fa3";

async function searchTmdb(query, year) {
    console.log(`Searching for: ${query} (${year || 'No Year'})`);
    let url = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&query=${encodeURIComponent(query)}`;
    if (year) url += `&year=${year}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.results && data.results.length > 0) {
            console.log(`Found ${data.results.length} results:`);
            data.results.forEach((r, i) => {
                console.log(`[${i}] ${r.title} (${r.release_date}) ID: ${r.id}`);
                console.log(`    Overview: ${r.overview.substring(0, 100)}...`);
            });
            return data.results;
        } else {
            console.log("No results found.");
            return [];
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

async function run() {
    console.log("--- Searching 2018 ---");
    await searchTmdb("Benjamin", "2018");
    console.log("\n--- Searching 2019 ---");
    await searchTmdb("Benjamin", "2019");
    console.log("\n--- Searching No Year ---");
    await searchTmdb("Benjamin");
}

run();
