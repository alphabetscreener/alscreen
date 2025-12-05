
function generateRtUrl(title, type) {
    const slug = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '_');
    const typePath = (type === 'TV Series' || type === 'Series') ? 'tv' : 'm';
    return `https://www.rottentomatoes.com/${typePath}/${slug}`;
}

const tests = [
    { title: "The Matrix", type: "Movie", expected: "https://www.rottentomatoes.com/m/the_matrix" },
    { title: "Breaking Bad", type: "TV Series", expected: "https://www.rottentomatoes.com/tv/breaking_bad" },
    { title: "Avengers: Endgame", type: "Movie", expected: "https://www.rottentomatoes.com/m/avengers_endgame" },
    { title: "Spider-Man: No Way Home", type: "Movie", expected: "https://www.rottentomatoes.com/m/spiderman_no_way_home" } // Note: RT might use spider_man, but this is our best guess
];

tests.forEach(t => {
    const result = generateRtUrl(t.title, t.type);
    console.log(`Title: "${t.title}" (${t.type})`);
    console.log(`Generated: ${result}`);
    console.log(`Expected:  ${t.expected}`);
    console.log(result === t.expected ? "MATCH" : "MISMATCH");
    console.log("---");
});
