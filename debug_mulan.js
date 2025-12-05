
function testTitleExtraction() {
    const options = [
        "Mulan (1998) - Movie",
        "Mulan (2020) - Movie"
    ];

    const titlesToFetch = [];
    const indexMap = {};

    console.log("--- Current Logic ---");
    options.forEach((opt, idx) => {
        // Mock cleanMarkdown
        const cleanOpt = opt;
        let title = cleanOpt;
        // Current Regex
        const match = cleanOpt.match(/^(.*?)(?:\s*\(|\s*-)/);
        if (match) title = match[1].trim();

        console.log(`Option: "${opt}" -> Extracted: "${title}"`);

        if (title) {
            titlesToFetch.push(title);
            indexMap[title] = idx;
        }
    });

    console.log("\nTitles to Fetch:", JSON.stringify(titlesToFetch));
    console.log("Index Map:", JSON.stringify(indexMap));

    if (Object.keys(indexMap).length < options.length) {
        console.log("❌ COLLISION DETECTED: Index map has fewer keys than options.");
    } else {
        console.log("✅ No collision.");
    }

    console.log("\n--- Proposed Logic (Include Year) ---");
    const newTitles = [];
    const newMap = {};

    options.forEach((opt, idx) => {
        const cleanOpt = opt;
        // New Regex: Capture everything before " - " or end of string
        // But wait, some might be "Title - Type". 
        // Better: "Title (Year)" is usually safe.
        // Let's try capturing up to the last closing parenthesis if it exists?
        // Or just everything before " - "

        let title = cleanOpt;
        const match = cleanOpt.match(/^(.*?)(?:\s*-\s*|$)/);
        if (match) title = match[1].trim();

        console.log(`Option: "${opt}" -> Extracted: "${title}"`);

        if (title) {
            newTitles.push(title);
            newMap[title] = idx;
        }
    });

    console.log("New Titles:", JSON.stringify(newTitles));
    console.log("New Map:", JSON.stringify(newMap));
}

testTitleExtraction();
