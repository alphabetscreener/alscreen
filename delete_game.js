import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyARPoq2DciZEQGds2RVdS-8xHTLlmdAn-c",
    authDomain: "alphabet-screener.firebaseapp.com",
    projectId: "alphabet-screener",
    storageBucket: "alphabet-screener.firebasestorage.app",
    messagingSenderId: "706881741466",
    appId: "1:706881741466:web:ef04216efa1e683e0d3523",
    measurementId: "G-GFXNJGZJZ6"
};

const appId = "1:706881741466:web:ef04216efa1e683e0d3523";
const DB_COLLECTION = 'content_v12';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function deleteRecord() {
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', DB_COLLECTION);

    console.log("Searching for titles starting with 'The Last of Us'...");
    // Range query for prefix search
    const q = query(colRef, where("title", ">=", "The Last of Us"), where("title", "<=", "The Last of Us\uf8ff"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        console.log("No matches found.");
        return;
    }

    await processSnapshot(snapshot);
}

async function processSnapshot(snapshot) {
    for (const d of snapshot.docs) {
        const data = d.data();
        console.log(`Found: "${data.title}" (${data.year}) - Type: ${data.type} - ID: ${d.id}`);

        // Delete if it looks like the video game
        if (data.year === "2013" || (data.title && data.title.includes("Video Game"))) {
            console.log(`DELETING: ${d.id}`);
            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_COLLECTION, d.id));
            console.log("Deleted.");
        } else {
            console.log("Skipping (does not match criteria).");
        }
    }
}

deleteRecord().then(() => {
    console.log("Done.");
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
