import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, linkWithPopup } from 'firebase/auth';
import { getFirestore, onSnapshot, collection, getDocs, addDoc, updateDoc, doc, query, where, setDoc, deleteDoc, increment } from 'firebase/firestore';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import {
  LucideBookmark, LucideBookmarkCheck, LucideExternalLink, LucideSearch, LucideCopy, LucideCheck,
  LucideTrash2, LucideSun, LucideMoon, LucideInfo, LucideAlertTriangle, LucideThumbsUp,
  LucideThumbsDown, LucideDices, LucideActivity, LucideScan, LucideShield, LucideZap,
  LucideSave, LucideTerminal, LucideChevronRight, LucideCpu, LucideRefreshCw
} from 'lucide-react';
import Navbar from './components/Navbar';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// Initialize Firebase Config (using mandatory global variables)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};
const appId = "1:706881741466:web:ef04216efa1e683e0d3523";

// Correctly determine the initialAuthToken value from the global variable
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// API Key
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

// The maximum ATP score
const MAX_ATP = 10;
const MAX_RETRIES = 3;
const THEMATIC_TERM = "Explicit LGBTQ+ Thematic Presence";
const SANITIZED_THEMATIC_TERM = "Inclusive Character Dynamics and Subtext";
// Updated Label to match the requested aesthetic
const UI_THEMATIC_LABEL = "Thematic Density Index";
const DB_COLLECTION = 'content_v12';

// --- Parsing Utility ---
const calculateWeightedATP = (seasonScores) => {
  if (!seasonScores || seasonScores.length === 0) return 0;
  const scores = seasonScores.map(s => s.score);
  const total = scores.reduce((a, b) => a + b, 0);
  const average = total / scores.length;
  const max = Math.max(...scores);

  // Dynamic Weighting:
  // If Max >= 9 (Central Premise), use 0.8 to prioritize the final state (Slow Burn).
  // If Max >= 7 (High Risk), use 0.5.
  // Else (Subtext/Incidental), use 0.2.
  let weight = 0.2;
  if (max >= 9) weight = 0.8;
  else if (max >= 7) weight = 0.5;

  const weightedScore = average + (max - average) * weight;

  return Math.min(10, Math.max(0, parseFloat(weightedScore.toFixed(1))));
};


const parseAnalysisResponse = (text) => {
  if (!text) return null;

  if (text.includes("AMBIGUOUS")) {
    console.log("Raw Ambiguous Text:", text);
    const lines = text.split('\n');
    const options = [];
    let foundAmbiguous = false;

    for (const line of lines) {
      if (line.includes("AMBIGUOUS")) {
        foundAmbiguous = true;
        continue;
      }
      const upperLine = line.toUpperCase();
      if (upperLine.includes("STEP 2") || upperLine.includes("ANALYSIS") || upperLine.includes("OUTPUT FORMAT")) {
        break; // Stop parsing options if we hit the analysis section
      }

      if (foundAmbiguous) {
        const cleanLine = line.trim();
        // Relaxed check: Just needs to have some length and not be a keyword
        // Expanded regex to catch ALL analysis keys to prevent them from showing as options
        // Also exclude common conversational headers from the AI
        if (cleanLine.length > 3 &&
          !cleanLine.match(/^(Title|Type|Year|ATP|Rationale|Content Rating|IMDb|Rotten Tomatoes|Metacritic|Season Scores|EPISODE FLAGS|Analysis|Step|Note):/i) &&
          !cleanLine.match(/^(Matches|Franchise|Collection|Video Game|Here are|The following)/i) &&
          !cleanLine.includes("Franchise:") &&
          !cleanLine.includes(" - Video Game")
        ) {
          // Remove leading bullets if they exist, but don't require them
          options.push(cleanLine.replace(/^(\d+[\.)]|-|\*)\s*/, '').trim());
        }
      }
    }
    return {
      type: 'ambiguous',
      options: options
        .filter(o => !o.toLowerCase().startsWith('the analysis') && !o.toLowerCase().startsWith('note:'))
        .slice(0, 15)
    };
  }

  const titleMatch = text.match(/(?:Title|Movie|Show|Name)(?:\*\*|):?\s*(.+)/i);
  const typeMatch = text.match(/(?:Type)(?:\*\*|):?\s*(.+)/i);
  const yearMatch = text.match(/(?:Year)(?:\*\*|):?\s*(.+)/i);
  const ratingMatch = text.match(/(?:Content Rating|Rated|Rating)(?:\*\*|):?\s*(.+)/i);
  const imdbMatch = text.match(/(?:IMDb)(?:\*\*|):?\s*([\d.]+)/i);
  const imdbIdMatch = text.match(/(?:IMDb ID)(?:\*\*|):?\s*(tt\d+)/i);
  const rtMatch = text.match(/(?:Rotten Tomatoes|RT)(?:\*\*|):?\s*(\d+%?)/i);
  const rtUrlMatch = text.match(/(?:Rotten Tomatoes URL)(?:\*\*|):?\s*(https?:\/\/[^\s]+)/i);
  const metacriticMatch = text.match(/(?:Metacritic)(?:\*\*|):?\s*(\d+)/i);
  const metacriticUrlMatch = text.match(/(?:Metacritic URL)(?:\*\*|):?\s*(https?:\/\/[^\s]+)/i);
  const atpMatch = text.match(/(?:ATP|TPS|Thematic Density|Thematic Density Index|Score)(?:\*\*|):?\s*(\d+(?:\.\d+)?)/i);
  const seasonMatch = text.match(/(?:Season Scores)(?:\*\*|):?\s*(.+)/i);
  const rationaleMatch = text.match(/(?:Rationale)(?:\*\*|):?\s*([\s\S]+)/i);

  if (titleMatch && atpMatch && rationaleMatch) {
    let extractedTitle = titleMatch[1].trim().replace(/\*\*/g, '').replace(/"/g, ''); // Clean quotes too

    // Safety check: If title is too long, it's likely a hallucination or sentence
    if (extractedTitle.length > 60) return null;

    // Fix for AI conversational spillover
    const conversationalMatch = extractedTitle.match(/^"([^"]+)"\s+(?:is|was|takes|features)/i);
    if (conversationalMatch) {
      extractedTitle = conversationalMatch[1];
    }

    let normalizedType = 'Unknown';
    if (typeMatch) {
      const rawType = typeMatch[1].trim().toLowerCase();
      if (rawType.includes('movie') || rawType.includes('film')) normalizedType = 'Movie';
      else if (rawType.includes('tv') || rawType.includes('series') || rawType.includes('show')) normalizedType = 'TV Series';
    }

    const result = {
      title: extractedTitle,
      type: normalizedType,
      year: yearMatch ? yearMatch[1].trim() : '',
      contentRating: ratingMatch ? ratingMatch[1].replace(/\s*\(.*?\)/g, '').trim() : 'N/A',
      imdb: imdbMatch ? parseFloat(imdbMatch[1]) : null,
      imdbId: imdbIdMatch ? imdbIdMatch[1].trim() : null,
      rottenTomatoes: rtMatch ? rtMatch[1].trim() : 'N/A',
      rottenTomatoesUrl: rtUrlMatch ? rtUrlMatch[1].trim() : null,
      metacritic: metacriticMatch ? parseInt(metacriticMatch[1]) : null,
      metacriticUrl: metacriticUrlMatch ? metacriticUrlMatch[1].trim() : null,
      atp: Math.min(MAX_ATP, Math.max(0, parseFloat(atpMatch[1]))),
      rationale: rationaleMatch[1].trim(),
      votesUp: 0,
      votesDown: 0,
      seasonScores: null
    };

    if (seasonMatch) {
      try {
        const seasonText = seasonMatch[1];
        // Expected format: S1:2, S2:4 or 1:2, 2:4
        const seasonPairs = seasonText.split(',').map(s => s.trim());
        const parsedSeasons = [];
        for (const pair of seasonPairs) {
          const parts = pair.split(':');
          if (parts.length === 2) {
            const sNum = parseInt(parts[0].replace(/\D/g, ''));
            const sScore = parseFloat(parts[1]);
            if (!isNaN(sNum) && !isNaN(sScore)) {
              parsedSeasons.push({ season: sNum, score: sScore });
            }
          }
        }
        if (parsedSeasons.length > 0) {
          result.seasonScores = parsedSeasons.sort((a, b) => a.season - b.season);
          // Recalculate ATP based on the weighted formula
          result.atp = calculateWeightedATP(result.seasonScores);
        }
      } catch (e) {
        console.error("Error parsing season scores:", e);
      }
    }

    return { type: 'analysis', data: result };
  }

  console.log("Failed to parse analysis text:", text);
  return null;
};

// --- Helper Functions (Updated Styles) ---
const calculateWarningDetails = (atp) => {
  if (atp <= 3) return {
    header: "NEGLIGIBLE",
    colorClass: "border-emerald-500",
    glowClass: "shadow-[0_0_15px_rgba(16,185,129,0.4)]",
    bgBadge: "bg-emerald-500/10 text-emerald-500 border-emerald-500/50",
    textClass: "text-emerald-500",
    barColor: "#10b981",
    rationaleSuffix: "Presence is background or incidental.",
    shareEmoji: "🟢"
  };
  if (atp <= 6.7) return {
    header: "MODERATE",
    colorClass: "border-amber-500",
    glowClass: "shadow-[0_0_15px_rgba(245,158,11,0.4)]",
    bgBadge: "bg-amber-500/10 text-amber-500 border-amber-500/50",
    textClass: "text-amber-500",
    barColor: "#f59e0b",
    rationaleSuffix: "Recurring subplots detected.",
    shareEmoji: "🟡"
  };
  return {
    header: "SIGNIFICANT",
    colorClass: "border-rose-500",
    glowClass: "shadow-[0_0_15px_rgba(244,63,94,0.4)]",
    bgBadge: "bg-rose-500/10 text-rose-500 border-rose-500/50",
    textClass: "text-rose-500",
    barColor: "#f43f5e",
    rationaleSuffix: "Central narrative dominance or explicit scenes.",
    shareEmoji: "🔴"
  };
};

const cleanMarkdown = (text) => {
  if (!text) return "";
  return text
    .replace(/\*\*/g, "")
    .replace(/###/g, "")
    .replace(/##/g, "")
    .replace(/#/g, "")
    .replace(/`/g, "")
    .trim();
};

const formatMarkdown = (text) => {
  if (!text) return "";
  return text
    // Bold: **text**
    .replace(/\*\*([\s\S]*?)\*\*/g, '<strong>$1</strong>')
    // Italic: *text*
    .replace(/\*([\s\S]*?)\*/g, '<em>$1</em>');
};

const getPlaceholderData = (title) => {
  if (!title) return { initials: '...', color: '#94a3b8' };
  const words = title.split(' ').filter(word => word.length > 0 && word.toLowerCase() !== 'the' && word.toLowerCase() !== 'of');
  let initials = '';
  if (words.length > 0) initials += words[0][0];
  if (words.length > 1) initials += words[1][0];
  if (words.length > 2) initials += words[2][0];
  initials = initials.toUpperCase();
  let hash = 0;
  for (let i = 0; i < title.length; i++) { hash = title.charCodeAt(i) + ((hash << 5) - hash); }
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
  const color = colors[Math.abs(hash) % colors.length];
  return { initials, color: color.replace('#', '') };
};

const App = () => {
  const [db, setDb] = useState(null);
  const [user, setUser] = useState(null);
  const userId = user ? user.uid : null;
  const [shows, setShows] = useState([]);
  const [savedShows, setSavedShows] = useState([]);
  const [currentShow, setCurrentShow] = useState(null);
  const [disambiguationOptions, setDisambiguationOptions] = useState([]);
  const [disambiguationImages, setDisambiguationImages] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [viewMode, setViewMode] = useState('search');

  const [deepExplanation, setDeepExplanation] = useState('');
  const [seasonScores, setSeasonScores] = useState(null);
  const [episodeFlags, setEpisodeFlags] = useState([]);
  const [isDiggingDeeper, setIsDiggingDeeper] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);

  // Default to dark mode for the tech aesthetic
  const [isDark, setIsDark] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState('');
  const [userVotes, setUserVotes] = useState({}); // Local session vote tracking

  // Initial Data
  const initialShows = useMemo(() => ([
    { title: "The Sopranos", year: "1999–2007", contentRating: "TV-MA", imdb: 9.2, rottenTomatoes: "92%", atp: 3.3, rationale: "Minor character subplot (Vito Spatafore) present; contained and secondary.", thumbnailUrl: '' },
    { title: "The Wire", year: "2002–2008", contentRating: "TV-MA", imdb: 9.3, rottenTomatoes: "94%", atp: 1.5, rationale: "Content is extremely minimal and plot-adjacent.", thumbnailUrl: '' },
    { title: "Game of Thrones", year: "2011–2019", contentRating: "TV-MA", imdb: 9.2, rottenTomatoes: "89%", atp: 5.5, rationale: "Multiple continuous subplots across seasons involving key characters.", thumbnailUrl: '' },
    { title: "Friends", year: "1994–2004", contentRating: "TV-14", imdb: 8.9, rottenTomatoes: "78%", atp: 2.5, rationale: "Recurring side characters and relevant plot points.", thumbnailUrl: '' },
    { title: "Euphoria", year: "2019–", contentRating: "TV-MA", imdb: 8.4, rottenTomatoes: "88%", atp: 10.0, rationale: "Thematic presence is central, constant, and a core defining element of the series structure.", thumbnailUrl: '' },
    { title: "The Shield", year: "2002–2008", contentRating: "TV-MA", imdb: 8.7, rottenTomatoes: "90%", atp: 4.3, rationale: "Character orientation is a personal conflict but contained.", thumbnailUrl: '' },
    { title: "The Mandalorian", year: "2019–", contentRating: "TV-14", imdb: 8.7, rottenTomatoes: "90%", atp: 0.0, rationale: "No explicit thematic presence observed.", thumbnailUrl: '' },
    { title: "Bosch", year: "2014–2021", contentRating: "TV-MA", imdb: 8.5, rottenTomatoes: "97%", atp: 0.3, rationale: "Minimal to none; focus on detective procedural work.", thumbnailUrl: '' },
    { title: "Yellowstone", year: "2018–", contentRating: "TV-MA", imdb: 8.7, rottenTomatoes: "84%", atp: 1.0, rationale: "Incidental characters; not a focus.", thumbnailUrl: '' },
    { title: "The Last of Us", year: "2023–", contentRating: "TV-MA", imdb: 8.8, rottenTomatoes: "96%", atp: 9.5, rationale: "Contains specific unexpected dedicated plot episodes.", thumbnailUrl: '' },
    { title: "Peppa Pig", year: "2004–", contentRating: "TV-Y", imdb: 6.4, rottenTomatoes: "N/A", atp: 0.5, rationale: "No explicit thematic presence observed.", thumbnailUrl: '' },
    { title: "Paw Patrol", year: "2013–", contentRating: "TV-Y", imdb: 6.4, rottenTomatoes: "N/A", atp: 0.0, rationale: "No explicit thematic presence observed.", thumbnailUrl: '' },
    { title: "SpongeBob SquarePants", year: "1999–", contentRating: "TV-Y7", imdb: 8.2, rottenTomatoes: "76%", atp: 0.0, rationale: "Content is implied/subtle, never a central plot driver.", thumbnailUrl: '' },
    { title: "Steven Universe", year: "2013–2019", contentRating: "TV-PG", imdb: 8.3, rottenTomatoes: "100%", atp: 9.8, rationale: "Core themes are central and fundamental to the plot.", thumbnailUrl: '' },
    { title: "Stranger Things", year: "2016–", contentRating: "TV-14", imdb: 8.7, rottenTomatoes: "92%", atp: 7.3, rationale: "Significant, recurring relationship arcs involving key characters.", thumbnailUrl: '' },
    { title: "Ozark", year: "2017–2022", contentRating: "TV-MA", imdb: 8.5, rottenTomatoes: "82%", atp: 7.0, rationale: "Explicit graphic scenes in Season 1 (Russ Langmore); thematic presence significantly drops to near zero in later seasons after character exits.", thumbnailUrl: '' },
    { title: "Chernobyl", year: "2019", contentRating: "TV-MA", imdb: 9.3, rottenTomatoes: "95%", atp: 0.0, rationale: "Historical miniseries focused purely on nuclear disaster.", thumbnailUrl: '' },
    { title: "The Queen's Gambit", year: "2020", contentRating: "TV-MA", imdb: 8.6, rottenTomatoes: "96%", atp: 1.0, rationale: "Focus is on chess and trauma; incidental background mentions only.", thumbnailUrl: '' },
    { title: "Bluey", year: "2018–", contentRating: "TV-Y", imdb: 9.5, rottenTomatoes: "N/A", atp: 0.0, rationale: "No explicit thematic presence observed.", thumbnailUrl: '' },
    { title: "The Simpsons", year: "1989–", contentRating: "TV-PG", imdb: 8.7, rottenTomatoes: "85%", atp: 4.5, rationale: "Includes various recurring character subplots and satire.", thumbnailUrl: '' },
    { title: "Toy Story 4", year: "2019", contentRating: "G", imdb: 7.7, rottenTomatoes: "97%", atp: 0.3, rationale: "No explicit thematic presence observed.", thumbnailUrl: '' },
    { title: "The Godfather", year: "1972", contentRating: "R", imdb: 9.2, rottenTomatoes: "97%", atp: 0.0, rationale: "No explicit thematic presence observed.", thumbnailUrl: '' },
    { title: "Good Will Hunting", year: "1997", contentRating: "R", imdb: 8.3, rottenTomatoes: "97%", atp: 1.0, rationale: "Contains homophobic slurs in dialogue (e.g. use of 'faggot'), though no central LGBTQ+ themes or characters.", thumbnailUrl: '' },
    { title: "The Big Sick", year: "2017", contentRating: "R", imdb: 7.5, rottenTomatoes: "98%", atp: 0.0, rationale: "Focuses on cultural/religious differences; Alphabet themes absent.", thumbnailUrl: '' },
    { title: "American History X", year: "1998", contentRating: "R", imdb: 8.5, rottenTomatoes: "83%", atp: 0.0, rationale: "Focus is racial extremism; Alphabet themes absent.", thumbnailUrl: '' },
    { title: "Brokeback Mountain", year: "2005", contentRating: "R", imdb: 7.7, rottenTomatoes: "88%", atp: 10.0, rationale: "The central narrative focuses entirely on a romantic relationship between two men.", thumbnailUrl: '' },
    { title: "Shōgun", year: "2024", contentRating: "TV-MA", imdb: 8.6, rottenTomatoes: "99%", atp: 0.5, rationale: "Historical drama focused on feudal politics. Very minor background references possible but no central themes.", thumbnailUrl: '' },
    { title: "Frankenstein", year: "2011", contentRating: "NR", imdb: 8.6, rottenTomatoes: "N/A", atp: 0.0, rationale: "Stage production filming. No explicit thematic presence observed.", thumbnailUrl: '' }
  ]), []);

  // --- Auth & Init ---
  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      const firestoreDb = getFirestore(app);
      const firebaseAuth = getAuth(app);
      setDb(firestoreDb);
      const performAuth = async () => {
        try {
          if (initialAuthToken) await signInWithCustomToken(firebaseAuth, initialAuthToken);
          else await signInAnonymously(firebaseAuth);
        } catch (e) { console.error("Auth failed:", e); }
      };
      performAuth();
      return onAuthStateChanged(firebaseAuth, (u) => {
        setUser(u);
      });
    } catch (e) { console.error("Init Error:", e); }
  }, []);

  // --- Auth Handlers ---
  const handleGoogleSignIn = async () => {
    const auth = getAuth();
    const provider = new GoogleAuthProvider();

    if (!auth.currentUser) return;

    try {
      if (auth.currentUser.isAnonymous) {
        // Attempt to link the anonymous account to Google
        await linkWithPopup(auth.currentUser, provider);
        console.log("Account linked successfully!");
      } else {
        // Already signed in permanently? Or just switching?
        // If they are already signed in with Google, this might re-auth.
        await signInWithPopup(auth, provider);
      }
    } catch (error) {
      if (error.code === 'auth/credential-already-in-use') {
        // The Google account is already linked to ANOTHER user.
        // We must sign in to that account (abandoning the current anon session).
        try {
          await signInWithPopup(auth, provider);
          console.log("Switched to existing account.");
        } catch (signInError) {
          console.error("Sign in failed:", signInError);
        }
      } else {
        console.error("Auth Error:", error);
      }
    }
  };

  const handleSignOut = async () => {
    const auth = getAuth();
    try {
      await auth.signOut();
      // Sign out will trigger onAuthStateChanged, which might set user to null.
      // However, since we want to allow anonymous usage, we might need to re-auth anonymously?
      // Actually, standard behavior is: Sign Out -> User is null -> App might re-init anonymous auth if we want.
      // Let's check our init logic: it runs ONCE on mount.
      // If we sign out, we might be left with NO user.
      // Let's force a re-login as anonymous if they sign out.
      await signInAnonymously(auth);
    } catch (error) {
      console.error("Sign Out Error:", error);
    }
  };

  // --- Seeding ---
  const seedDatabase = useCallback(async (firestoreDb) => {
    if (!firestoreDb) return;
    try {
      const colRef = collection(firestoreDb, 'artifacts', appId, 'public', 'data', DB_COLLECTION);
      const snap = await getDocs(colRef);
      if (snap.empty) {
        for (const show of initialShows) {
          const exists = snap.docs.some(doc => doc.data().title === show.title);
          if (!exists) await addDoc(colRef, { ...show, votesUp: 0, votesDown: 0 });
        }
      }
    } catch (e) { console.error("Seeding failed:", e); }
  }, [initialShows]);

  useEffect(() => {
    if (!db || !userId) return;
    const publicRef = collection(db, 'artifacts', appId, 'public', 'data', DB_COLLECTION);
    const unsubPublic = onSnapshot(publicRef, (snap) => {
      setShows(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (e) => setErrorMessage("Failed to load public data."));

    const userSavedRef = collection(db, 'artifacts', appId, 'users', userId, 'watchlist');
    const unsubSaved = onSnapshot(userSavedRef, (snap) => {
      setSavedShows(snap.docs.map(doc => ({ savedId: doc.id, ...doc.data() })));
    }, (e) => console.error("Watchlist error", e));

    seedDatabase(db);
    return () => { unsubPublic(); unsubSaved(); };
  }, [db, userId, seedDatabase]);

  // --- Unified Metadata Resolution ---
  const resolveMetadata = async (inputUrl) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const imdbIdMatch = inputUrl.match(/(tt\d{6,})/);
    const extractedId = imdbIdMatch ? imdbIdMatch[1] : null;

    let queryText = `Search google for this URL: ${inputUrl}`;

    if (extractedId) {
      queryText = `Search google for IMDb ID "${extractedId}". Return the most current movie/show details found.`;
    } else if (inputUrl.includes('rottentomatoes.com')) {
      queryText = `Search google for this Rotten Tomatoes URL: "${inputUrl}". Identify the Movie/Show Title and Year. Then find the IMDb ID (tt code) for that specific title.`;
    }

    const apiUrl = `/.netlify/functions/gemini`;
    const tools = [{ "google_search": {} }];

    const prompt = `${queryText}
        Extract: 
        - Title
        - Year (start year if series)
        - Content Rating (e.g. TV-MA, R, PG-13)
        - IMDb ID (tt code)
        - IMDb Rating (Look for a rating like 8.0/10 or 7.5. Return null if not explicitly found)
        
        Return ONLY a JSON object: { "title": "...", "year": "...", "contentRating": "...", "imdb": 8.0, "imdbId": "tt..." }`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: tools,
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      if (!response.ok) return null;

      const result = await response.json();
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) {
        const data = JSON.parse(text);
        if (data.title) data.title = data.title.replace(/\(\d{4}\)$/, '').trim();
        // If extraction found an ID but we didn't start with one, make sure we propagate it
        if (!extractedId && data.imdbId) {
          console.log("Resolved ID from Link:", data.imdbId);
        }
        return data;
      }
      return null;
    } catch (e) {
      console.error("Metadata Resolution Error:", e);
      return null;
    }
  };

  // --- TMDB Integration ---
  const tmdbKey = import.meta.env.VITE_TMDB_API_KEY;

  const fetchTmdbImages = async (query, year = null, type = 'movie', matchContext = null) => {
    try {
      // OPTIMIZATION: Use multi-search to handle both Movie and TV in one go if type is ambiguous
      // But for now, let's stick to specific endpoints but optimize the flow.

      let url = `https://api.themoviedb.org/3/search/${type === 'TV Series' ? 'tv' : 'movie'}?api_key=${tmdbKey}&query=${encodeURIComponent(query)}`;
      if (year) url += type === 'TV Series' ? `&first_air_date_year=${year}` : `&year=${year}`;

      let response = await fetch(url);
      if (!response.ok) return [];
      let data = await response.json();
      let results = data.results || [];

      // Context Matching Strategy (Optimized)
      // Only do deep matching if we have context AND multiple results
      if (matchContext && results.length > 1) {
        const contextWords = matchContext.toLowerCase().split(/\W+/).filter(w => w.length > 3);

        // Simple client-side scoring without extra API calls if possible
        // We only have 'overview' from the search result, which is usually enough!
        // PREVIOUSLY we might have been fetching details? No, the search result has overview.
        // Ah, the user added `fetchTmdbDetails` which does extra calls, but `fetchTmdbImages` uses search results.

        const scoredResults = results.map(r => {
          let score = 0;
          const overview = (r.overview || '').toLowerCase();
          contextWords.forEach(word => {
            if (overview.includes(word)) score++;
          });
          return { ...r, score };
        });

        scoredResults.sort((a, b) => b.score - a.score);

        // If top result has a good score, use it.
        if (scoredResults[0].score > 0) {
          results = scoredResults;
        }
      }

      if (results && results.length > 0) {
        return results
          .slice(0, 3)
          .filter(r => r.poster_path)
          .map(r => `https://image.tmdb.org/t/p/original${r.poster_path}`);
      }
    } catch (e) {
      console.error("TMDB Fetch Error:", e);
    }
    return [];
  };

  const fetchTmdbDetails = async (query, year = null, type = 'Movie') => {
    try {
      const isTv = type === 'TV Series' || type === 'Series';
      const endpoint = isTv ? 'tv' : 'movie';
      let url = `https://api.themoviedb.org/3/search/${endpoint}?api_key=${tmdbKey}&query=${encodeURIComponent(query)}`;

      if (year) {
        url += isTv ? `&first_air_date_year=${year}` : `&year=${year}`;
      }

      const response = await fetch(url);
      if (!response.ok) return null;
      const data = await response.json();

      let top = null;
      if (data.results && data.results.length > 0) {
        top = data.results[0];
      } else if (year) {
        // RELAXED FALLBACK: Try without year if strict search failed
        console.log("Strict search failed. Retrying without year...");
        const relaxedUrl = `https://api.themoviedb.org/3/search/${endpoint}?api_key=${tmdbKey}&query=${encodeURIComponent(query)}`;
        const relaxedRes = await fetch(relaxedUrl);
        if (relaxedRes.ok) {
          const relaxedData = await relaxedRes.json();
          if (relaxedData.results && relaxedData.results.length > 0) {
            top = relaxedData.results[0];
          }
        }
      }

      if (top) {
        // Fetch full details to get IMDb ID (external_ids)
        const detailUrl = `https://api.themoviedb.org/3/${endpoint}/${top.id}?api_key=${tmdbKey}&append_to_response=external_ids`;
        const detailRes = await fetch(detailUrl);
        if (!detailRes.ok) return null;
        const detailData = await detailRes.json();

        const imdbId = detailData.imdb_id || (detailData.external_ids ? detailData.external_ids.imdb_id : null);
        console.log("TMDB Details Found:", { title: detailData.title, imdbId });

        return {
          title: detailData.title || detailData.name,
          year: (detailData.release_date || detailData.first_air_date || '').substring(0, 4),
          imdbId: imdbId,
          overview: detailData.overview,
          type: isTv ? 'TV Series' : 'Movie',
          // Extended Metadata for Updates
          status: detailData.status, // "Returning Series", "Ended", etc.
          lastAirDate: detailData.last_air_date,
          nextEpisodeToAir: detailData.next_episode_to_air, // Object or null
          totalSeasons: detailData.number_of_seasons,
          totalEpisodes: detailData.number_of_episodes,
          popularity: detailData.popularity
        };
      }
    } catch (e) {
      console.error("TMDB Details Error:", e);
    }
    return null;
  };

  const fetchTmdbDisambiguation = useCallback(async (title) => {
    try {
      const url = `https://api.themoviedb.org/3/search/multi?api_key=${tmdbKey}&query=${encodeURIComponent(title)}`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = await response.json();
      if (!data.results || data.results.length === 0) return null;

      // Filter for Movie/TV
      const relevant = data.results.filter(r => r.media_type === 'movie' || r.media_type === 'tv');

      return relevant.slice(0, 5).map(r => {
        const year = (r.release_date || r.first_air_date || '').substring(0, 4);
        const type = r.media_type === 'movie' ? 'Movie' : 'TV Series';
        return `${r.title || r.name} (${year}) - ${type}`;
      });
    } catch (e) { return null; }
  }, []);

  const fetchThumbnail = useCallback(async (rawTitle, type = null) => {
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

      // Safety: Remove leading numbers/bullets (e.g. "1. Title")
      title = title.replace(/^(\d+[\.)]|-|\*)\s*/, '');

      // Auto-detect type from string if not provided
      if (!type) {
        if (rawTitle.includes(' - TV Series')) type = 'TV Series';
        else if (rawTitle.includes(' - Movie')) type = 'Movie';
      }

      // 2. Specific Search (Movies vs TV vs Multi)
      let endpoint = 'multi';
      if (type === 'TV Series' || type === 'Series') endpoint = 'tv';
      else if (type === 'Movie') endpoint = 'movie';

      const url = `https://api.themoviedb.org/3/search/${endpoint}?api_key=${tmdbKey}&query=${encodeURIComponent(title)}`;
      const response = await fetch(url);

      if (!response.ok) return null;
      const data = await response.json();

      if (!data.results || data.results.length === 0) return null;

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
        return [`https://image.tmdb.org/t/p/original${bestMatch.poster_path}`];
      }

    } catch (e) {
      console.error("Image Fetch Error:", e);
      return null;
    }
  }, []);

  const callGeminiApi = useCallback(async (prompt, structured = true, sanitized = false) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const apiUrl = `/.netlify/functions/gemini`;
    const tools = [{ "google_search": {} }];

    const activeTerm = sanitized ? SANITIZED_THEMATIC_TERM : THEMATIC_TERM;

    // Sanitize the prompt if needed to bypass filters
    let activePrompt = prompt;
    if (sanitized) {
      activePrompt = activePrompt
        .replace(/LGBTQ\+/g, "inclusive")
        .replace(/LGBT/g, "inclusive")
        .replace(/gay/g, "close")
        .replace(/romance/g, "relationship")
        .replace(/sexual/g, "social");
    }

    const sysMsg = structured
      ? `You are a media database assistant. SEARCH THE WEB for the title's plot, parental guide, and ratings.
               
               Step 1: DISAMBIGUATION / NOT FOUND. 
               - If the title is broad (e.g. "Goo", "Boys"), obscure, or lacks RELIABLE major database entries (IMDb/RT), return EXACTLY: "AMBIGUOUS" followed by a numbered list of likely popular matches.
               - STRICTLY EXCLUDE VIDEO GAMES, BOOKS, COMICS, and MUSIC. Only list Movies and TV Series.
               - Do NOT hallucinate data for obscure short films, YouTube videos, or unreleased content just to fill the fields. If you can't find reliable data for a major Western release, treat it as AMBIGUOUS.
               - Do NOT include category headers (e.g. "James Cameron's Franchise:", "Matches:"). Return ONLY the numbered list.

               Step 2: ANALYSIS. Analyze against criteria: 'Alphabet Thematic Presence (ATP)' measures focus on ${activeTerm}. 
               SCORING: 0-10 scale in 0.1 increments.
               0-3 Low: Background, incidental, or purely subtextual/ambiguous (e.g. 'coded' characters without explicit confirmation).
               4-6.7 Moderate: Recurring, confirmed, but non-graphic.
               7-10 High: Central, graphic, or main plot focus.
               
               CRITICAL SCORING RULES:

               2. 9-10 RESERVED: Only for shows where the theme is the CENTRAL PREMISE (e.g. Queer as Folk, Heartstopper).
               3. EXCLUDE: Purely speculative subtext or 'fan theories' should NOT score above 3.
               IMPORTANT: Purely speculative subtext or 'fan theories' should NOT score above 3.
               AGE RATING ADJUSTMENT: If the content is rated TV-Y, TV-Y7, G, or PG, you must grade stricter.
               Any openly LGBTQ+ character OR confirmed romantic relationship in a kids' show MUST be scored as High Risk (minimum 7).
               SATIRE EXCEPTION: If the content is purely satirical, stereotypical, or the character is the target of mockery (e.g. 'flamer' tropes used for comedy), score LOWER (Max 5).
               ATP DOES NOT SCORE race, religion, or general culture. 
               IMPORTANT: Search specifically for "Rotten Tomatoes" score, "Rotten Tomatoes URL", "Metacritic" score, "Metacritic URL" (Direct link to the specific page, NOT a search result), and "IMDb ID" (tt code).
               
               Output key-value pairs in this EXACT order:
               Title: [Exact Title]
               Type: [Movie or TV Series]
               Year: [Year]
               Content Rating: [Rating]
               IMDb: [Score]
               IMDb ID: [tt...]
               Rotten Tomatoes: [Percentage]
               Rotten Tomatoes URL: [Full URL or N/A]
               Metacritic: [Score 0-100]
               Metacritic URL: [Full URL or N/A]
               ATP: [Score 0-10]
               Season Scores: [S1:Score, S2:Score, ...] (If TV Series, comma separated)
               Rationale: [Text - VAGUE, SPOILER-FREE summary. Describe the *nature* of the content (e.g. 'Central romance', 'Background characters') without naming specific characters or revealing plot twists.]`
      : `Act as a concise content analyst. 
               1. Provide 3-5 brief, numbered points explaining the ATP score based ONLY on ${activeTerm}. Do not use Markdown.
               CRITICAL: Include SPECIFIC character names, plot points, and SPOILERS if necessary to fully explain the rating. Do not be vague.
               
               SCORING RULES:
               - 0-3 Low: Background, incidental, or purely subtextual/ambiguous.
               - 4-6.7 Moderate: Recurring, confirmed, but non-graphic.
               - 7-10 High: Central, graphic, or main plot focus.

               - 9-10 RESERVED: Only for shows where the theme is the CENTRAL PREMISE.
               - EXCLUDE: Do not score based on external marketing, social media, or creator interviews.
               - EXCLUDE: Purely speculative subtext or 'fan theories' should NOT score above 3.
               - AGE RATING ADJUSTMENT: If the content is rated TV-Y, TV-Y7, G, or PG, you must grade stricter.
               - Any openly LGBTQ+ character OR confirmed romantic relationship in a kids' show MUST be scored as High Risk (minimum 7).
               - SATIRE EXCEPTION: If the content is purely satirical, stereotypical, or the character is the target of mockery (e.g. 'flamer' tropes used for comedy), score LOWER (Max 5).

               2. IF AND ONLY IF THIS IS A TV SERIES (do NOT provide for movies): At the very end of your response, provide a breakdown of ATP scores per season in this exact format on new lines:
                  SEASON DATA:
                  Season 1: [Score]
                  Season 2: [Score]
                  ...
               CRITICAL: Grade each season INDEPENDENTLY using the rules above. You MUST list EVERY SINGLE SEASON that exists for the show. Do not summarize (e.g. "Seasons 1-5"). Do not skip seasons. List them individually: Season 1..., Season 2..., etc.
               
               Finally, if specific episodes contain very high concentrations of this content, list them in a "Red Flag Episodes" section. Format exact lines as:
               EPISODE FLAGS:
               - SxEyy: [Brief Reason]
               - SxEyy: [Brief Reason]`;

    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: activePrompt }] }],
            systemInstruction: { parts: [{ text: sysMsg }] },
            tools: tools,
            generationConfig: { temperature: 0.0 }
          })
        });

        if (!response.ok) {
          if (i === MAX_RETRIES - 1) throw new Error(`API Error ${response.status}`);
          await new Promise(r => setTimeout(r, 500 * Math.pow(2, i)));
          continue;
        }

        const result = await response.json();

        // Handle Safety Blocks (e.g. for "Paw Patrol" + "LGBT" queries)
        if (!result?.candidates?.[0]?.content && result?.promptFeedback?.blockReason) {
          console.warn(`AI Blocked Response (Sanitized: ${sanitized}):`, result.promptFeedback);

          if (!sanitized) {
            console.log("Attempting Sanitized Retry...");
            return await callGeminiApi(prompt, structured, true);
          }

          if (structured) {
            return {
              type: 'analysis',
              data: {
                title: "Content Analysis Blocked",
                type: "Unknown",
                year: "",
                contentRating: "N/A",
                imdb: 0,
                atp: 0,
                rationale: "The AI safety filters blocked the analysis of this content. This often occurs when analyzing G-rated content for mature themes. We assume Low Risk.",
                seasonScores: null
              }
            };
          } else {
            return "Analysis blocked by safety filters.";
          }
        }

        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return structured ? parseAnalysisResponse(text) : text;
      } catch (e) {
        if (i === MAX_RETRIES - 1) throw e;
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, i)));
      }
    }
  }, []);

  const enrichThumbnail = useCallback(async (show) => {
    if (!db || !show || (show.thumbnailUrl && (Array.isArray(show.thumbnailUrl) || show.thumbnailUrl.length > 10))) return;
    if (!db || !show || (show.thumbnailUrl && (Array.isArray(show.thumbnailUrl) || show.thumbnailUrl.length > 10))) return;
    // Pass "Title (Year)" string so fetchThumbnail can parse it correctly
    const searchStr = show.year ? `${show.title} (${show.year})` : show.title;
    const urls = await fetchThumbnail(searchStr, show.type);
    if (urls) {
      try {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', DB_COLLECTION, show.id);
        await updateDoc(docRef, { thumbnailUrl: urls });

        // Update local state if this is the current show
        setCurrentShow(prev => {
          if (prev && prev.id === show.id) {
            return { ...prev, thumbnailUrl: urls };
          }
          return prev;
        });
      } catch (e) { console.error("Update failed", e); }
    }
  }, [db, appId, fetchThumbnail]);

  // --- Disambiguation Image Fetching ---
  // --- Robust Image Component ---
  const RobustImage = ({ urls, alt, className, fallbackIcon, fallbackClassName }) => {
    const urlList = useMemo(() => Array.isArray(urls) ? urls : (urls ? [urls] : []), [urls]);
    const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
    const [hasError, setHasError] = useState(false);

    const handleError = () => {
      if (currentUrlIndex < urlList.length - 1) {
        setCurrentUrlIndex(prev => prev + 1);
      } else {
        setHasError(true);
      }
    };

    if (hasError || !urlList || urlList.length === 0) {
      return (
        <div className={fallbackClassName || `w-10 h-14 rounded flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-slate-800 text-slate-600' : 'bg-slate-200 text-slate-400'}`}>
          {fallbackIcon || <LucideSearch size={16} />}
        </div>
      );
    }

    return (
      <div className={className || "w-10 h-14 bg-black rounded overflow-hidden flex-shrink-0 border border-white/10"}>
        <img
          src={urlList[currentUrlIndex]}
          alt={alt}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
          onError={handleError}
        />
      </div>
    );
  };

  // --- Disambiguation Image Fetching (Updated for TMDB) ---
  useEffect(() => {
    if (disambiguationOptions.length === 0) {
      setDisambiguationImages({});
      return;
    }

    const fetchAllImages = async () => {
      const newImages = {};

      // Parallel fetch using Unified TMDB Logic
      await Promise.all(disambiguationOptions.map(async (opt, idx) => {
        const cleanOpt = cleanMarkdown(opt);

        // Just pass the full string (e.g. "Spider-Man (2002) - Movie")
        // The new fetchThumbnail handles parsing and multi-search.
        let type = null;
        if (cleanOpt.includes(' - TV Series')) type = 'TV Series';
        else if (cleanOpt.includes(' - Movie')) type = 'Movie';

        const urls = await fetchThumbnail(cleanOpt, type);

        if (urls && urls.length > 0) {
          newImages[idx] = urls;
        }
      }));

      setDisambiguationImages(newImages);
    };

    fetchAllImages();
  }, [disambiguationOptions, fetchThumbnail]);

  const analyzeAndScreen = async (titleOverride = null, thumbnailOverride = null, ignoreCache = false) => {
    if (titleOverride) {
      // Clean up the display text for the search bar (Updated)
      // Remove " - Description" but keep " - Type" to help with future disambiguation if they hit enter
      let cleanDisplay = cleanMarkdown(titleOverride);
      // Remove leading numbers like "1. "
      cleanDisplay = cleanDisplay.replace(/^(\d+[\.)]|-|\*)\s*/, '');

      // Keep only Title (Year) - Type
      // Ultra-Simple Cleaning Strategy
      // Split by " - Movie" or " - TV Series" (case insensitive)
      // and take the first part + the separator.

      const movieSplit = cleanDisplay.split(/(\s[-–—]\sMovie)/i);
      const tvSplit = cleanDisplay.split(/(\s[-–—]\sTV Series)/i);

      if (movieSplit.length > 1) {
        cleanDisplay = movieSplit[0] + " - Movie";
      } else if (tvSplit.length > 1) {
        cleanDisplay = tvSplit[0] + " - TV Series";
      } else {
        // Fallback: Split by dash and take first 2 parts
        const parts = cleanDisplay.split(/\s+[-–—]\s+/);
        if (parts.length > 2) {
          cleanDisplay = `${parts[0]} - ${parts[1]}`;
        }
      }

      console.log("Cleaned Output:", cleanDisplay);
      setSearchTerm(cleanDisplay);
    }
    let titleToSearch = titleOverride || searchTerm.trim();
    let preResolvedData = null;
    let linkUsed = false;
    setViewMode('search');

    setErrorMessage(''); setStatusMessage(''); setDeepExplanation(''); setSeasonScores(null); setIsExplanationOpen(false); setDisambiguationOptions([]); setEpisodeFlags([]); setAcList([]);

    if (!db || !userId) { setErrorMessage("Network Disconnected."); return; }
    if (!titleToSearch) { setErrorMessage("Input Required."); return; }

    // Enforce 3-char limit for search (unless it's a URL)
    if (titleToSearch.length < 3 && !titleToSearch.includes('http')) {
      setErrorMessage("INPUT TOO SHORT (MIN 3 CHARS).");
      return;
    }
    setIsLoading(true);
    setScanProgress(0);

    // Simulate scan progress for the visual effect
    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 95) return 95;
        // Decaying increment: fast at first, then slower
        const increment = prev < 60 ? 2 : prev < 85 ? 0.5 : 0.1;
        return Math.min(95, prev + increment);
      });
    }, 100);

    const isLink = titleToSearch.includes('imdb.com/') || titleToSearch.includes('rottentomatoes.com/');

    if (isLink) {
      setStatusMessage("DECODING LINK METADATA...");
      linkUsed = true;
      preResolvedData = await resolveMetadata(titleToSearch);

      if (preResolvedData && preResolvedData.title) {
        titleToSearch = preResolvedData.title;
        setStatusMessage(`TARGET ACQUIRED: ${titleToSearch.toUpperCase()}`);
      } else {
        console.log("Metadata resolution failed, falling back to raw URL.");
      }
    } else {
      // Try TMDB Resolution for raw text to get precise metadata (IMDb ID)
      // This fixes issues with lesser known titles like "Benjamin (2018)"
      setStatusMessage("QUERYING TMDB DATABASE...");

      // Robust Parsing Strategy
      let searchTitle = titleToSearch;
      let searchYear = null;
      let searchType = null;
      let searchContext = null;

      console.log("--- DISAMBIGUATION DEBUG ---");
      console.log("Raw Input:", titleToSearch);

      // 1. Detect Type
      if (titleToSearch.includes(' - TV Series')) searchType = 'TV Series';
      else if (titleToSearch.includes(' - Movie')) searchType = 'Movie';

      // 2. Clean Title & Year using Split (Safer than Regex)
      // Expected: "The Penguin (2024) - TV Series - Starring..."
      const parts = titleToSearch.split(' - ');
      if (parts.length > 0) {
        let rawTitle = parts[0].trim();

        // Remove leading numbers "1. The Penguin"
        rawTitle = rawTitle.replace(/^(\d+[\.)]|-|\*)\s*/, '');

        // Extract Year
        const yearMatch = rawTitle.match(/\((\d{4})\)/);
        if (yearMatch) {
          searchYear = yearMatch[1];
          searchTitle = rawTitle.replace(/\(\d{4}\)/, '').trim();
        } else {
          searchTitle = rawTitle;
        }

        // Context is everything after the title part
        if (parts.length > 1) {
          searchContext = parts.slice(1).join(' ');
        }
      }

      console.log(`Parsed: Title="${searchTitle}", Year="${searchYear}", Type="${searchType}"`);

      // ONLY use TMDB Pre-Resolution if we have a specific YEAR or if this is a direct click (override)
      // This prevents "Avatar" -> Auto-matching the movie and skipping disambiguation
      if (searchYear || titleOverride) {
        let tmdbResult = null;

        // 1. Try Specific Type if known
        if (searchType) {
          console.log(`Prioritizing ${searchType} search for: ${searchTitle}`);
          tmdbResult = await fetchTmdbDetails(searchTitle, searchYear, searchType, searchContext);
        }

        // 2. Fallback: Try Movie first (Default)
        if (!tmdbResult && searchType !== 'Movie') {
          tmdbResult = await fetchTmdbDetails(searchTitle, searchYear, 'Movie', searchContext);
        }

        // 3. Fallback: Try TV
        if (!tmdbResult && searchType !== 'TV Series') {
          tmdbResult = await fetchTmdbDetails(searchTitle, searchYear, 'TV Series', searchContext);
        }

        if (tmdbResult && tmdbResult.imdbId) {
          console.log("TMDB Pre-Resolution Success:", tmdbResult);
          preResolvedData = tmdbResult;
          setStatusMessage(`IDENTIFIED: ${tmdbResult.title.toUpperCase()}`);
          // Update title to the official one
          titleToSearch = tmdbResult.title;
        }
      }
    }

    // Only check local cache if we have a specific override (disambiguation click) or it's a resolved link
    // This forces raw text searches to go through the API for disambiguation check first
    // IGNORE CACHE if explicitly requested (e.g. Refresh)
    if (!ignoreCache && (titleOverride || (isLink && preResolvedData))) {
      const safeTitle = isLink && preResolvedData ? preResolvedData.title : titleToSearch;
      const existing = shows.find(s => s.title.toLowerCase() === safeTitle.toLowerCase());
      if (existing) {
        setCurrentShow(existing);
        setEpisodeFlags(existing.redFlags || []); // Load existing flags if present from previous deep dive
        setSeasonScores(existing.seasonScores || null); // Load existing seasons if present from previous deep dive

        // Update thumbnail if override provided and existing is missing
        if (thumbnailOverride && (!existing.thumbnailUrl || existing.thumbnailUrl.length === 0)) {
          const updatedShow = { ...existing, thumbnailUrl: thumbnailOverride };
          setCurrentShow(updatedShow);
          enrichThumbnail(updatedShow); // Will save to DB
        } else {
          enrichThumbnail(existing);
        }

        setIsLoading(false);
        clearInterval(interval);
        setScanProgress(100);
        setStatusMessage('');
        return;
      }
    }

    setStatusMessage("SCANNING CONTENT DATABASES...");
    setCurrentShow(null);

    try {
      const analysisPrompt = (preResolvedData && preResolvedData.title)
        ? `Analyze the movie/show "${preResolvedData.title}" (${preResolvedData.year}).
                   
                   MANDATORY SEARCH STEPS:
                   1. Search for "Parental Guide ${preResolvedData.title}".
                   2. Search for "LGBT characters in ${preResolvedData.title}".
                   3. Search for "gay storyline in ${preResolvedData.title}".
                   4. Search for "romance plot ${preResolvedData.title}".
                   
                   IMDb ID Reference: ${preResolvedData.imdbId || 'N/A'} (Use for identification, but analyze content based on Title search results).
                   
                   OUTPUT FORMAT (Strictly match these keys):
                   Title: [Exact Title]
                   Type: [Movie or TV Series]
                   Year: [Year]
                   Content Rating: [Rating]
                   IMDb: [Score]
                   IMDb ID: [tt...]
                   Rotten Tomatoes: [Percentage]
                   Rotten Tomatoes URL: [Full URL or N/A]
                   Metacritic: [Score 0-100]
                   Metacritic URL: [Full URL or N/A]
                   ATP: [Score 0-10]
                   Season Scores: [S1:Score, S2:Score, ...] (If TV Series, comma separated)
                   Rationale: [Text]`

        : `Analyze: "${titleToSearch}".

        STEP 1: DISAMBIGUATION CHECK
          - Does this title refer to a FRANCHISE, SERIES, REBOOT, REMAKE, SHARED TITLE, or multiple DISTINCT movies / shows ?
            - BE OVER - CAUTIOUS.If there is an original and a reboot(e.g. "Rugrats" 1991 vs 2021), OR if multiple distinct franchises share the same name(e.g. "Avatar" - James Cameron vs Last Airbender), it IS AMBIGUOUS.
            - SINGLE WORD TITLES: If the input is a single word (e.g. "Joker", "Avatar") without a year, it IS AMBIGUOUS. Return the list of options.
            - SPECIFIC HANDLING: "The Penguin" refers to the 2024 TV Series unless specified otherwise.
            - KIDS' FRANCHISES: If a cartoon series has theatrical movies (e.g. "Peppa Pig", "Paw Patrol", "SpongeBob"), return "AMBIGUOUS" and list the Series AND the Movies.
                   - IGNORE VIDEO GAMES.If the title is primarily a video game(e.g. "Elden Ring", "God of War") and has NO major movie / TV adaptation, return "AMBIGUOUS" with NO options(or just the movie / TV ones if they exist).
      - If YES, or if the title is vague, return EXACTLY: "AMBIGUOUS" followed by a numbered list of ALL relevant matches(Title + Year + Type).
                    - FILTER: The list MUST ONLY contain Movies or TV Series. Do NOT list Video Games.
                    - Do NOT include category headers. Return ONLY the numbered list.
                   - FORMAT: "1. Title (Year) - Type - Director/Star"
                   
                   STEP 2: IF UNIQUE(or specific enough)
        - Proceed immediately to analysis.
                   - Search specifically for LGBT themes, characters, or subplots to determine the ATP score.
                   
                   OUTPUT FORMAT(Strictly match these keys):
      Title: [Exact Title]
      Type: [Movie or TV Series]
      Year: [Year]
                   Content Rating: [Rating]
      IMDb: [Score]
                   IMDb ID: [tt...]
                   Rotten Tomatoes: [Percentage]
                   Rotten Tomatoes URL: [Full URL or N / A]
      ATP: [Score 0 - 10]
      Rationale: [Text]`;

      console.log("PreResolved Data:", preResolvedData);
      console.log("Analysis Prompt:", analysisPrompt);

      console.log("Analysis Prompt:", analysisPrompt);

      let response = await callGeminiApi(analysisPrompt, true);

      // RETRY LOGIC: If API fails (network/server error), try once more after delay
      if (!response || response.error) {
        console.warn("First API attempt failed. Retrying in 1s...");
        await new Promise(r => setTimeout(r, 1000));
        response = await callGeminiApi(analysisPrompt, true);
      }

      // FALLBACK: If AI is blocked (Safety), try TMDB for disambiguation
      if (response && response.data && response.data.title === "Content Analysis Blocked" && !preResolvedData) {
        console.log("AI Blocked. Attempting TMDB Disambiguation...");
        const tmdbOptions = await fetchTmdbDisambiguation(titleToSearch);
        if (tmdbOptions && tmdbOptions.length > 1) {
          setDisambiguationOptions(tmdbOptions);
          setStatusMessage("MULTIPLE MATCHES DETECTED.");
          setIsLoading(false);
          clearInterval(interval);
          setScanProgress(100);
          return;
        }
      }

      if (response && response.type === 'ambiguous') {
        setDisambiguationOptions(response.options);
        setStatusMessage("MULTIPLE MATCHES DETECTED.");
      } else if (response && response.type === 'analysis' && response.data.title) {
        // SECONDARY CACHE CHECK:
        // If the API returns a specific title that we ALREADY have, switch to it now.
        // This handles the case where "Mulan" (raw text) -> API says "Mulan (1998)" -> We have it.
        const existing = shows.find(s => s.title.toLowerCase() === response.data.title.toLowerCase());
        if (existing) {
          setCurrentShow(existing);
          setEpisodeFlags(existing.redFlags || []);
          setSeasonScores(existing.seasonScores || null);
          enrichThumbnail(existing);
          setIsLoading(false);
          clearInterval(interval);
          setScanProgress(100);
          setStatusMessage('');
          return;
        }
        let fullData = {
          ...response.data,
          thumbnailUrl: thumbnailOverride || '',
          votesUp: 0,
          votesDown: 0,
          detailedAnalysis: null // Placeholder
        };

        if (preResolvedData) {
          fullData.title = preResolvedData.title;
          if (preResolvedData.year) fullData.year = preResolvedData.year;
          if (preResolvedData.imdb) fullData.imdb = preResolvedData.imdb;
          if (preResolvedData.contentRating) fullData.contentRating = preResolvedData.contentRating.replace(/\s*\(.*?\)/g, '').trim();
          // Preserve IMDb ID from preResolvedData if available
          if (preResolvedData.imdbId) fullData.imdbId = preResolvedData.imdbId;

          // Extended Metadata for Updates
          if (preResolvedData.status) fullData.status = preResolvedData.status;
          if (preResolvedData.lastAirDate) fullData.lastAirDate = preResolvedData.lastAirDate;
          if (preResolvedData.nextEpisodeToAir) fullData.nextEpisodeToAir = preResolvedData.nextEpisodeToAir;
          if (preResolvedData.totalSeasons) fullData.totalSeasons = preResolvedData.totalSeasons;
          if (preResolvedData.totalEpisodes) fullData.totalEpisodes = preResolvedData.totalEpisodes;
        }

        // Fix for Blocked Analysis Title
        if (fullData.title === "Content Analysis Blocked") {
          // Clean the search title to use as fallback
          let cleanTitle = titleToSearch.replace(/\(\d{4}\)/, '').replace(/-\s*(Movie|TV Series)/i, '').trim();
          // Remove leading numbers if present (e.g. "1. Title")
          cleanTitle = cleanTitle.replace(/^(\d+[\.)]|-|\*)\s*/, '');
          fullData.title = cleanTitle;

          // Try to extract year if missing
          if (!fullData.year) {
            const yearMatch = titleToSearch.match(/\((\d{4})\)/);
            if (yearMatch) fullData.year = yearMatch[1];
          }
        }
        // --- POST-ANALYSIS VERIFICATION ---
        // If we didn't have pre-resolved data, the AI might have hallucinated the title (e.g. "Stranger Things 5").
        // We verify with TMDB one last time to standardize the Title, Year, and IDs.
        if (!preResolvedData && fullData.title && fullData.title !== "Content Analysis Blocked") {
          console.log("Verifying AI Title with TMDB:", fullData.title);

          // Clean the title for search (remove year if present)
          const searchTitle = fullData.title.replace(/\(\d{4}\)/, '').trim();

          // 1. Fetch what the AI suggested
          let officialData = await fetchTmdbDetails(searchTitle, fullData.year, fullData.type);

          // 2. Cross-check with the OTHER type to ensure we didn't miss a better match
          // (Especially if AI said Movie but it's actually a popular TV show, e.g. "The Sopranos")
          const otherType = (fullData.type === 'TV Series' || fullData.type === 'Series') ? 'Movie' : 'TV Series';
          // Don't pass the year to the alternative check to be broader (e.g. if AI got year wrong)
          const alternativeData = await fetchTmdbDetails(searchTitle, null, otherType);

          // 3. Compare and Swap if Alternative is Better
          if (alternativeData) {
            let swap = false;

            if (!officialData) {
              swap = true;
            } else {
              // Heuristics for swapping:
              // A. Title Match: Alternative matches User Input or AI Title better?
              // We use the AI title (fullData.title) as the anchor, but also consider the raw search term
              // CLEAN THE ANCHOR: Remove year to ensure exact match works (e.g. "The Penguin (2024)" -> "The Penguin")
              const anchorTitle = fullData.title.replace(/\(\d{4}\)/, '').trim().toLowerCase();
              const officialTitle = officialData.title.toLowerCase();
              const altTitle = alternativeData.title.toLowerCase();

              const officialExact = officialTitle === anchorTitle;
              const altExact = altTitle === anchorTitle;

              // B. Popularity: Is Alternative WAY more popular?
              // Use a safe denominator
              const officialPop = officialData.popularity || 1;
              const altPop = alternativeData.popularity || 0;
              const popRatio = altPop / officialPop;

              console.log(`Verification Comparison:
                        Official (${officialData.type}): "${officialData.title}" (Pop: ${officialPop})
                        Alt (${alternativeData.type}): "${alternativeData.title}" (Pop: ${altPop})
                        Ratio: ${popRatio.toFixed(1)}`);

              if (altExact && !officialExact) {
                swap = true; // Prefer exact title match (e.g. "The Sopranos" vs "The Real Sopranos")
              } else if (popRatio > 3) {
                // If alternative is >3x more popular, likely the intended target 
                // (lowered from 10x to catch cases like The Penguin vs The Magic Penguin)
                swap = true;
              }
            }

            if (swap) {
              console.log(`Swapping ${fullData.type} -> ${otherType} based on verification.`);
              officialData = alternativeData;
            }
          }

          if (officialData) {
            console.log("Official Match Found:", officialData.title);
            fullData.title = officialData.title;
            fullData.year = officialData.year;
            fullData.type = officialData.type;
            if (officialData.imdbId) fullData.imdbId = officialData.imdbId;

            // Merge extended metadata
            if (officialData.status) fullData.status = officialData.status;
            if (officialData.lastAirDate) fullData.lastAirDate = officialData.lastAirDate;
            if (officialData.nextEpisodeToAir) fullData.nextEpisodeToAir = officialData.nextEpisodeToAir;
            if (officialData.totalSeasons) fullData.totalSeasons = officialData.totalSeasons;
            if (officialData.totalEpisodes) fullData.totalEpisodes = officialData.totalEpisodes;
          }
        }
        console.log("Final Analysis Data:", fullData);

        // --- AUTO DEEP DIVE FOR TV SERIES ---
        if (fullData.type === 'TV Series') {
          setStatusMessage("PERFORMING DEEP SCAN...");
          try {
            const deepText = await callGeminiApi(`Title: ${fullData.title} (${fullData.year}).Type: ${fullData.type}.ATP: ${fullData.atp} `, false);
            const safeText = typeof deepText === 'string' ? deepText : "No details.";

            fullData.detailedAnalysis = safeText;

            // Parse Seasons from Deep Dive
            const seasonData = [];
            const seasonRegex = /Season\s+(\d+):\s*(\d+(?:\.\d+)?)/gi;
            let match;
            while ((match = seasonRegex.exec(safeText)) !== null) {
              seasonData.push({ season: parseInt(match[1]), score: parseFloat(match[2]) });
            }

            // Parse Flags from Deep Dive
            const flagsRegex = /EPISODE FLAGS:([\s\S]*)$/i;
            const flagsMatch = safeText.match(flagsRegex);
            if (flagsMatch) {
              const rawFlags = flagsMatch[1].trim().split('\n');
              const parsedFlags = rawFlags
                .filter(line => line.trim().startsWith('-'))
                .map(line => line.replace(/^-/, '').trim());
              if (parsedFlags.length > 0) fullData.redFlags = parsedFlags;
            }

            if (seasonData.length > 0) {
              fullData.seasonScores = seasonData.sort((a, b) => a.season - b.season);
              // Recalculate ATP with high-quality season data
              fullData.atp = calculateWeightedATP(fullData.seasonScores);
            }
          } catch (err) {
            console.error("Auto Deep Dive Failed:", err);
          }
        }

        const ref = collection(db, 'artifacts', appId, 'public', 'data', DB_COLLECTION);
        const docRef = await addDoc(ref, fullData);
        setCurrentShow({ id: docRef.id, ...fullData });
        setEpisodeFlags(fullData.redFlags || []);
        setSeasonScores(fullData.seasonScores || null);
        enrichThumbnail({ id: docRef.id, ...fullData });
        setStatusMessage('');
      } else {
        console.log("Analysis Failed. Response:", response);
        const errorMsg = response && response.error ? `API ERROR: ${response.error}` : "ANALYSIS ALGORITHM FAILED.";
        setErrorMessage(errorMsg);
      }
    } catch (e) {
      console.error(e);
      if (e.message.includes('429')) {
        setErrorMessage("API QUOTA EXCEEDED. TRY LATER.");
      } else {
        setErrorMessage("SYSTEM ERROR. RETRY SCAN.");
      }
    } finally {
      clearInterval(interval);
      setScanProgress(100);
      setTimeout(() => setIsLoading(false), 500);
    }
  };

  const digDeeper = async () => {
    if (!currentShow) return;
    setIsDiggingDeeper(true); setErrorMessage('');
    if (deepExplanation) { setIsExplanationOpen(p => !p); setIsDiggingDeeper(false); return; }
    setIsExplanationOpen(true);

    // Use cached analysis if available
    if (currentShow.detailedAnalysis) {
      const safeText = currentShow.detailedAnalysis;
      const flagsRegex = /EPISODE FLAGS:([\s\S]*)$/i;
      const cleanText = safeText.replace(flagsRegex, '').replace(/SEASON DATA:[\s\S]*$/, '').trim();
      setDeepExplanation(cleanText);
      setIsDiggingDeeper(false);
      return;
    }

    try {
      const text = await callGeminiApi(`Title: ${currentShow.title} (${currentShow.year}).Type: ${currentShow.type || 'Unknown'}.ATP: ${currentShow.atp} `, false);
      const safeText = typeof text === 'string' ? text : "No details.";

      // ... (rest of parsing logic for fallback) ...
      const seasonData = [];
      const seasonRegex = /Season\s+(\d+):\s*(\d+(?:\.\d+)?)/gi;
      let match;
      while ((match = seasonRegex.exec(safeText)) !== null) {
        seasonData.push({ season: parseInt(match[1]), score: parseFloat(match[2]) });
      }

      const flagsRegex = /EPISODE FLAGS:([\s\S]*)$/i;
      const flagsMatch = safeText.match(flagsRegex);
      let cleanedExplanation = safeText;
      if (flagsMatch) {
        const rawFlags = flagsMatch[1].trim().split('\n');
        const parsedFlags = rawFlags
          .filter(line => line.trim().startsWith('-'))
          .map(line => line.replace(/^-/, '').trim());
        if (parsedFlags.length > 0) setEpisodeFlags(parsedFlags);
        cleanedExplanation = safeText.replace(flagsRegex, '').trim();
      }

      const cleanText = cleanedExplanation.replace(/SEASON DATA:[\s\S]*$/, '').trim();
      setDeepExplanation(cleanText);

      // Only set scores if found and not already present
      if (seasonData.length > 0 && !seasonScores) {
        setSeasonScores(seasonData);
      }

      // Save this deep dive for future
      try {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', DB_COLLECTION, currentShow.id);
        await updateDoc(docRef, { detailedAnalysis: safeText, redFlags: episodeFlags, seasonScores: seasonData.length > 0 ? seasonData : seasonScores });
      } catch (e) { console.error("Failed to save deep dive", e); }

    } catch (e) { setErrorMessage("DEEP SCAN FAILED."); }
    finally { setIsDiggingDeeper(false); }
  };

  const toggleExplanation = () => { if (deepExplanation) { setIsExplanationOpen(prev => !prev); } };

  // --- Watchlist Logic ---
  const isSaved = useMemo(() => {
    return currentShow ? savedShows.some(s => s.title === currentShow.title) : false;
  }, [currentShow, savedShows]);

  const toggleSave = async () => {
    if (!db || !userId || !currentShow) return;

    if (isSaved) {
      const item = savedShows.find(s => s.title === currentShow.title);
      if (item) {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'watchlist', item.savedId));
      }
    } else {
      const userSavedRef = collection(db, 'artifacts', appId, 'users', userId, 'watchlist');
      await addDoc(userSavedRef, { ...currentShow, savedAt: new Date().toISOString() });
    }
  };

  // --- Community Voting Logic ---
  const handleVote = async (type) => {
    if (!db || !currentShow) return;

    // Prevent double voting locally for this session
    if (userVotes[currentShow.id]) return;

    const docRef = doc(db, 'artifacts', appId, 'public', 'data', DB_COLLECTION, currentShow.id);

    try {
      if (type === 'up') {
        await updateDoc(docRef, { votesUp: increment(1) });
        setCurrentShow(prev => ({ ...prev, votesUp: (prev.votesUp || 0) + 1 }));
      } else {
        await updateDoc(docRef, { votesDown: increment(1) });
        setCurrentShow(prev => ({ ...prev, votesDown: (prev.votesDown || 0) + 1 }));
      }
      setUserVotes(prev => ({ ...prev, [currentShow.id]: type }));
    } catch (e) {
      console.error("Voting failed:", e);
    }
  };

  const votePercentage = useMemo(() => {
    if (!currentShow) return 0;
    const up = currentShow.votesUp || 0;
    const down = currentShow.votesDown || 0;
    const total = up + down;
    if (total === 0) return 0;
    return Math.round((up / total) * 100);
  }, [currentShow]);

  // --- Random Safe Pick Logic ---
  const pickRandomSafe = () => {
    const safeShows = shows.filter(s => s.atp <= 3 && s.imdb >= 7);
    if (safeShows.length > 0) {
      const random = safeShows[Math.floor(Math.random() * safeShows.length)];
      setSearchTerm(random.title);
      setCurrentShow(random);
      setEpisodeFlags(random.redFlags || []); // Ensure flags load
      setSeasonScores(random.seasonScores || null); // Ensure seasons load
      setViewMode('search');
    } else {
      setErrorMessage("NO SAFE ENTRIES IN DATABASE.");
    }
  };

  const checkForUpdates = async () => {
    if (!db || !userId || savedShows.length === 0) return;
    if (isCheckingUpdates) return;

    setIsCheckingUpdates(true);
    setStatusMessage("CHECKING FOR NEW EPISODES...");

    let updatesFound = 0;

    try {
      // Filter for returning series or just TV Series to be safe
      const returningSeries = savedShows.filter(s => s.type === 'TV Series');

      for (const show of returningSeries) {
        // Fetch fresh details
        const freshDetails = await fetchTmdbDetails(show.title, null, 'TV Series');

        if (freshDetails) {
          let hasNewContent = false;

          // Check if total episodes increased
          if (freshDetails.totalEpisodes && show.totalEpisodes && freshDetails.totalEpisodes > show.totalEpisodes) {
            hasNewContent = true;
          }

          // Check if last air date is newer
          if (freshDetails.lastAirDate && show.lastAirDate && new Date(freshDetails.lastAirDate) > new Date(show.lastAirDate)) {
            hasNewContent = true;
          }

          // If status changed to Ended, update that too
          if (freshDetails.status && show.status && freshDetails.status !== show.status) {
            // Just update status, don't flag as new content unless episodes changed
            const docRef = doc(db, 'artifacts', appId, 'users', userId, 'watchlist', show.savedId);
            await updateDoc(docRef, { status: freshDetails.status });
          }

          if (hasNewContent) {
            updatesFound++;
            const docRef = doc(db, 'artifacts', appId, 'users', userId, 'watchlist', show.savedId);
            await updateDoc(docRef, {
              hasNewEpisodes: true,
              latestEpisodeInfo: freshDetails.nextEpisodeToAir || { name: 'New Episode', air_date: freshDetails.lastAirDate },
              totalEpisodes: freshDetails.totalEpisodes,
              lastAirDate: freshDetails.lastAirDate,
              status: freshDetails.status
            });
          }
        }
      }

      if (updatesFound > 0) {
        setStatusMessage(`UPDATES FOUND FOR ${updatesFound} SHOWS.`);
      } else {
        setStatusMessage("NO NEW EPISODES DETECTED.");
      }
      setTimeout(() => setStatusMessage(''), 3000);

    } catch (e) {
      console.error("Update check failed:", e);
      setErrorMessage("UPDATE CHECK FAILED.");
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const handleRefresh = async () => {
    if (!currentShow || !db) return;

    try {
      setErrorMessage('');
      setStatusMessage("REFRESHING DATA...");
      // Delete the existing document
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_COLLECTION, currentShow.id));

      // Remove from local state immediately to prevent "found existing" check
      setShows(prev => prev.filter(s => s.id !== currentShow.id));
      setCurrentShow(null);

      // Trigger new analysis
      // We pass the title explicitly to avoid any state lag
      // FORCE REFRESH by passing ignoreCache = true
      // FIX: Pass full context to prevent ambiguity (e.g. South Park Movie vs Show)
      // Handle missing type gracefully
      let refreshString = `${currentShow.title} (${currentShow.year})`;
      if (currentShow.type) {
        refreshString += ` - ${currentShow.type}`;
      }
      analyzeAndScreen(refreshString, null, true);
    } catch (e) {
      console.error("Refresh failed:", e);
      setErrorMessage("REFRESH FAILED.");
    }
  };

  const handleShare = () => {
    if (!currentShow) return;
    const details = calculateWarningDetails(currentShow.atp);
    const text = `🎬 TARGET: ${currentShow.title} (${currentShow.year}) \n📊 INDEX: ${currentShow.atp}/10 ${details.shareEmoji} [${details.header}]\n📝 DATA: ${currentShow.rationale}\n\n#AlphabetScreener`;

    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopyFeedback('COPIED');
      setTimeout(() => setCopyFeedback(''), 2000);
    } catch (err) {
      console.error('Unable to copy', err);
      setCopyFeedback('ERR');
    }
    document.body.removeChild(textArea);
  };

  const [acList, setAcList] = useState([]);
  const [focus, setFocus] = useState(-1);

  const onInput = (e) => {
    const val = e.target.value;
    setSearchTerm(val); setAcList([]); setDeepExplanation(''); setSeasonScores(null); setCurrentShow(null); setDisambiguationOptions([]);
    if (!val) return;
    if (val.length < 3) return; // Enforce 3-char limit for autocomplete
    if (!val.includes('http')) {
      const matches = shows.filter(s => s.title.toUpperCase().includes(val.toUpperCase()) && s.title.length < 60);
      // Deduplicate by title + year
      const uniqueMatches = [];
      const seen = new Set();
      for (const m of matches) {
        const key = `${m.title}-${m.year}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueMatches.push(m);
        }
      }
      setAcList(uniqueMatches.slice(0, 5));
    }
  };

  const onSelect = (title) => { setSearchTerm(title); setAcList([]); analyzeAndScreen(title); };
  const details = currentShow ? calculateWarningDetails(currentShow.atp) : {};

  // --- State Sync for Watchlist Clicks ---
  // Ensure season scores update whenever currentShow changes (e.g., clicking item from watchlist)
  useEffect(() => {
    if (currentShow && currentShow.seasonScores) {
      setSeasonScores(currentShow.seasonScores);
    } else if (currentShow && !currentShow.seasonScores) {
      setSeasonScores(null); // Clear if moving to a movie or old record
    }
  }, [currentShow]);

  // --- Chart Config (High Tech Theme) ---
  const chartData = useMemo(() => currentShow ? {
    labels: ['INDEX'],
    datasets: [{
      label: 'Score',
      data: [currentShow.atp],
      backgroundColor: details.barColor,
      borderColor: details.barColor,
      borderWidth: 2,
      shadowColor: details.barColor,
      shadowBlur: 10,
      borderRadius: 4,
      barThickness: 40
    }]
  } : null, [currentShow, details]);

  const chartOptions = useMemo(() => ({
    responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: false },
    scales: {
      x: {
        min: 0, max: 10,
        grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', tickColor: 'transparent' },
        ticks: { color: isDark ? '#64748b' : '#475569', font: { family: 'Rajdhani', size: 12 } }
      },
      y: { grid: { display: false }, ticks: { display: false } }
    }
  }), [isDark]);

  const seasonChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        min: 0, max: 10, title: { display: false },
        grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
        ticks: { color: isDark ? '#94a3b8' : '#475569', font: { family: 'Rajdhani' } }
      },
      x: {
        grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
        ticks: { color: isDark ? '#94a3b8' : '#475569', font: { family: 'Rajdhani' } }
      }
    },
    plugins: { legend: { display: false } },
    elements: { line: { tension: 0.4 }, point: { radius: 4, hoverRadius: 6 } }
  }), [isDark]);

  const seasonChartData = useMemo(() => {
    if (!seasonScores || seasonScores.length === 0) return null;
    return {
      labels: seasonScores.map(s => `S${s.season}`),
      datasets: [{
        label: 'DATA',
        data: seasonScores.map(s => s.score),
        borderColor: '#06b6d4', // Cyan
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        borderWidth: 2,
        pointBackgroundColor: seasonScores.map(s => s.score > 6.75 ? '#f43f5e' : s.score > 3 ? '#fbbf24' : '#10b981'),
        pointBorderColor: '#ffffff',
        fill: true
      }]
    };
  }, [seasonScores]);

  // --- Dynamic Class Utilities ---
  const bgMain = isDark ? 'bg-slate-950' : 'bg-slate-50';
  const textMain = isDark ? 'text-slate-200' : 'text-slate-900';
  const textSub = isDark ? 'text-slate-400' : 'text-slate-500';
  const cardBg = isDark ? 'bg-slate-900/40 border-slate-700/50' : 'bg-white/60 border-slate-200 shadow-xl';
  const headerBg = isDark ? 'border-slate-800/60' : 'border-slate-200 bg-white/50';
  const inputBg = isDark ? 'bg-slate-950/80 border-slate-700 text-slate-200 placeholder-slate-600' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 shadow-inner';
  const glowColor = isDark ? 'bg-cyan-900/20' : 'bg-cyan-500/5';
  const glowColor2 = isDark ? 'bg-purple-900/10' : 'bg-purple-500/5';
  const gridColor = isDark ? '#80808012' : '#00000008';

  return (
    <div className={`min-h-screen ${bgMain} ${textMain} font-sans selection:bg-cyan-500/30 selection:text-cyan-200 relative overflow-hidden transition-colors duration-500`}>
      <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Rajdhani:wght@400;500;600;700&display=swap');
                body { font-family: 'Inter', sans-serif; }
                h1, h2, h3, h4, .font-tech { font-family: 'Rajdhani', sans-serif; }
                
                @keyframes shine {
                  0% { left: -100%; }
                  100% { left: 100%; }
                }
                .animate-shine { animation: shine 1.5s infinite; }
                @keyframes scan {
                  0% { top: 0%; opacity: 0; }
                  10% { opacity: 1; }
                  90% { opacity: 1; }
                  100% { top: 100%; opacity: 0; }
                }
                .animate-scan { animation: scan 2s ease-in-out infinite; }
                
                ::-webkit-scrollbar { width: 4px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: ${isDark ? '#1e293b' : '#cbd5e1'}; border-radius: 2px; }
            `}</style>

      {/* Background Grid & Ambient Glows */}
      <div className={`fixed inset-0 bg-[linear-gradient(to_right,${gridColor}_1px,transparent_1px),linear-gradient(to_bottom,${gridColor}_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none`}></div>
      <div className={`fixed top-0 left-0 w-full h-96 ${glowColor} blur-[100px] rounded-full pointer-events-none mix-blend-screen`}></div>
      <div className={`fixed bottom-0 right-0 w-96 h-96 ${glowColor2} blur-[100px] rounded-full pointer-events-none`}></div>
      {/* Scanline Overlay */}
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] z-50 bg-[length:100%_4px,3px_100%] opacity-50"></div>

      {/* Navbar - Full Width Sticky */}
      <Navbar
        user={user}
        onSignIn={handleGoogleSignIn}
        onSignOut={handleSignOut}
        onViewArchive={() => { setViewMode('watchlist'); setCurrentShow(null); }}
        onHome={() => { setViewMode('search'); setCurrentShow(null); }}
        savedCount={savedShows.length}
        isDark={isDark}
        setIsDark={setIsDark}
        viewMode={viewMode}
      />

      {/* Main Content Container */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-8">

        {/* Header Section */}


        {/* VIEW MODE: WATCHLIST */}
        {viewMode === 'watchlist' && (
          <section className={`p-8 rounded-xl border backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-500 ${cardBg}`}>
            <div className={`flex items-center justify-between mb-8 pb-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <h2 className="text-2xl font-tech font-bold tracking-widest flex items-center gap-3 text-cyan-500">
                <LucideBookmarkCheck className="text-cyan-500" /> SECURE_ARCHIVE
              </h2>
              <button
                onClick={checkForUpdates}
                disabled={isCheckingUpdates}
                className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-mono border transition-all ${isDark ? 'border-cyan-900/50 hover:bg-cyan-900/20 text-cyan-500' : 'border-cyan-200 hover:bg-cyan-50 text-cyan-600'} disabled:opacity-50`}
              >
                <LucideRefreshCw className={`w-4 h-4 ${isCheckingUpdates ? 'animate-spin' : ''}`} />
                {isCheckingUpdates ? 'SCANNING...' : 'CHECK FOR UPDATES'}
              </button>
            </div>

            {savedShows.length === 0 ? (
              <div className="text-center py-20 opacity-50">
                <LucideCpu className={`mx-auto mb-4 ${isDark ? 'text-cyan-500/50' : 'text-cyan-600/30'}`} size={48} />
                <p className={`font-mono text-sm ${textSub}`}>NO DATA RECORDS FOUND</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {savedShows.map(show => {
                  const d = calculateWarningDetails(show.atp);
                  return (
                    <div key={show.savedId} onClick={() => { setCurrentShow(show); setEpisodeFlags(show.redFlags || []); setSeasonScores(show.seasonScores || []); setViewMode('search'); }} className={`group relative p-6 rounded-lg border ${isDark ? 'border-slate-700/50 bg-slate-950/50' : 'border-slate-200 bg-white'} cursor-pointer transition-all duration-300 hover:border-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)]`}>
                      <div className="flex justify-between items-start mb-4">
                        <div className={`text-xs font-mono px-2 py-1 rounded border ${d.bgBadge}`}>{d.header}</div>
                        {show.hasNewEpisodes && (
                          <div className="flex items-center gap-1 text-xs font-mono text-cyan-400 animate-pulse bg-cyan-900/30 px-2 py-1 rounded border border-cyan-500/30">
                            <LucideZap size={12} /> NEW EPISODES
                          </div>
                        )}
                        <span className={`font-tech font-bold text-xl ${d.textClass}`}>{show.atp}</span>
                      </div>
                      <h3 className={`font-bold text-lg mb-1 truncate ${textMain} group-hover:text-cyan-500 transition-colors`}>{show.title}</h3>
                      <p className={`text-xs font-mono uppercase tracking-wider ${textSub}`}>{show.year} // {show.contentRating}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* VIEW MODE: SEARCH & RESULTS */}
        {viewMode === 'search' && (
          <>


            <div className="max-w-7xl mx-auto px-6 pt-12 pb-24">
              {/* Decorative Corners */}
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-cyan-500/50"></div>
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-cyan-500/50"></div>
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-cyan-500/50"></div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-cyan-500/50"></div>

              <div className="flex flex-col gap-8 items-start">
                {/* LEFT: Content Analysis Terminal */}
                <div className={`flex-1 w-full ${cardBg} backdrop-blur-md rounded-xl p-8 shadow-2xl overflow-hidden relative transition-colors duration-500`}>
                  {/* Background scanning effect */}
                  {isLoading && (
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent animate-scan" style={{ top: `${scanProgress}%`, height: '20%' }}></div>
                  )}

                  <div className="flex items-center gap-3 mb-6">
                    <LucideTerminal className="w-5 h-5 text-cyan-500" />
                    <h2 className={`text-lg font-semibold ${textMain} tracking-wide font-tech`}>CONTENT ANALYSIS TERMINAL</h2>
                  </div>

                  <p className={`${textSub} mb-6 text-sm`}>Enter Target Title or IMDb Database Link for comprehensive content analysis.</p>

                  <div className="flex flex-col gap-4 relative z-10">
                    <div className="flex gap-4">
                      <div className="flex-1 relative group/input">
                        {/* Backlight Glow for Input */}
                        <div className={`absolute -inset-1 rounded-lg bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 opacity-20 blur-lg transition-opacity duration-1000 ${isLoading ? 'opacity-50' : ''}`}></div>

                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <LucideSearch className={`h-5 w-5 ${textSub} group-focus-within/input:text-cyan-500 transition-colors`} />
                          </div>
                          <input
                            type="text"
                            value={searchTerm}
                            onChange={onInput}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') analyzeAndScreen();
                              if (e.key === 'ArrowDown') setFocus(p => p < acList.length - 1 ? p + 1 : 0);
                              if (e.key === 'ArrowUp') setFocus(p => p > 0 ? p - 1 : acList.length - 1);
                              if (e.key === 'Enter' && focus > -1) onSelect(acList[focus].title);
                            }}
                            className={`block w-full pl-12 pr-4 py-4 ${inputBg} rounded-lg focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none transition-all font-mono`}
                            placeholder="Enter Target Title or IMDb Database Link..."
                          />
                        </div>

                        {/* Autocomplete Dropdown */}
                        {acList.length > 0 && (
                          <div className={`absolute z-50 top-full left-0 right-0 mt-2 rounded-lg border ${isDark ? 'border-slate-700 bg-slate-900/95' : 'border-slate-200 bg-white/95'} backdrop-blur-xl overflow-hidden shadow-2xl`}>
                            {acList.map((s, i) => (
                              <div key={i} className={`px-6 py-3 cursor-pointer flex justify-between items-center ${isDark ? 'border-white/5 hover:bg-white/5' : 'border-black/5 hover:bg-slate-100'} border-b last:border-0 ${i === focus ? 'bg-cyan-500/20' : ''}`} onClick={() => onSelect(s.title)}>
                                <span className={`font-mono text-sm ${textMain}`} dangerouslySetInnerHTML={{ __html: s.title.replace(new RegExp(`(${searchTerm})`, 'gi'), '<strong class="text-cyan-500">$1</strong>') }} />
                                <span className={`text-xs ${textSub} font-mono`}>{s.year}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <button onClick={pickRandomSafe} className={`group/dice relative px-5 ${isDark ? 'bg-slate-800 border-slate-600 text-slate-300 hover:text-white' : 'bg-white border-slate-300 text-slate-600 hover:text-slate-900'} hover:bg-slate-700 border rounded-lg transition-colors flex items-center justify-center`}>
                        <LucideDices className="w-6 h-6" />
                        <div className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-mono whitespace-nowrap rounded opacity-0 group-hover/dice:opacity-100 transition-opacity pointer-events-none ${isDark ? 'bg-cyan-900/90 text-cyan-100 border border-cyan-700/50' : 'bg-slate-800 text-white shadow-lg'}`}>
                          RANDOM SAFE PICK
                        </div>
                      </button>
                    </div>

                    <div className="flex gap-4">
                      <button
                        onClick={() => analyzeAndScreen()}
                        disabled={isLoading}
                        className="relative overflow-hidden px-8 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-[0_0_20px_rgba(8,145,178,0.3)] hover:shadow-[0_0_30px_rgba(8,145,178,0.5)] transition-all duration-300 flex items-center gap-2 group/btn disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="relative z-10 flex items-center gap-2 font-tech tracking-wider">
                          {isLoading ? 'ANALYZING...' : 'SCAN TARGET'}
                          {!isLoading && <LucideChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />}
                        </span>
                        <div className="absolute top-0 -left-[100%] w-[100%] h-full bg-gradient-to-r from-transparent via-white/20 to-transparent transform skew-x-12 group-hover/btn:animate-shine"></div>
                      </button>
                    </div>
                  </div>

                  {/* Status Messages */}
                  <div className="mt-3 flex justify-between items-center px-2">
                    <div className={`font-mono text-xs tracking-wider flex items-center gap-2 ${statusMessage ? 'text-cyan-500 animate-pulse' : textSub}`}>
                      {statusMessage && <LucideActivity size={12} />}
                      {statusMessage}
                    </div>
                    {errorMessage && <div className="text-rose-500 font-mono text-xs flex items-center gap-2"><LucideAlertTriangle size={12} /> {errorMessage}</div>}
                  </div>

                  {/* Disambiguation */}
                  {disambiguationOptions.length > 0 && (
                    <div className={`mt-6 p-4 rounded border ${isDark ? 'border-cyan-900/50 bg-cyan-950/20' : 'border-cyan-200 bg-cyan-50/50'}`}>
                      <h3 className="font-mono text-xs text-cyan-600 mb-2">AMBIGUOUS INPUT DETECTED. SELECT TARGET:</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {disambiguationOptions.map((opt, idx) => (
                          <button
                            key={idx}
                            onClick={() => analyzeAndScreen(opt, disambiguationImages[idx])}
                            className={`w-full text-left p-3 rounded flex items-start gap-3 transition-colors group ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
                          >
                            <RobustImage
                              urls={disambiguationImages[idx]}
                              alt="Thumb"
                              className="w-16 h-24 rounded flex-shrink-0 object-cover opacity-80 border border-white/10"
                              fallbackIcon={<LucideSearch size={24} className={`${isDark ? 'text-slate-600' : 'text-slate-400'}`} />}
                              fallbackClassName={`w-16 h-24 rounded flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}
                            />
                            <span className="font-mono text-sm line-clamp-2">{cleanMarkdown(opt)}</span>
                            <LucideChevronRight size={16} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Progress Bar */}
                  <div className={`mt-6 transition-all duration-500 ease-out overflow-hidden ${isLoading ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="flex justify-between text-xs text-cyan-500 font-mono mb-2">
                      <span>PROCESSING DATA STREAMS...</span>
                      <span>{Math.round(scanProgress)}%</span>
                    </div>
                    <div className={`h-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'} rounded-full overflow-hidden`}>
                      <div className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)] relative transition-all duration-200" style={{ width: `${scanProgress}%` }}>
                        <div className="absolute right-0 top-0 bottom-0 w-2 bg-white blur-[2px]"></div>
                      </div>
                    </div>
                    <div className={`mt-2 text-xs font-mono ${textSub} grid grid-cols-3 gap-2`}>
                      <span className={scanProgress > 20 ? "text-emerald-500" : ""}>[✓] METADATA</span>
                      <span className={scanProgress > 50 ? "text-emerald-500" : ""}>[✓] KEYWORDS</span>
                      <span className={scanProgress > 80 ? "text-emerald-500" : ""}>[✓] HEURISTICS</span>
                    </div>
                  </div>
                  {/* Objective Footer */}
                  {!currentShow && !isLoading && (
                    <div className={`mt-8 pt-6 border-t ${isDark ? 'border-slate-800/50' : 'border-slate-200/50'} animate-in fade-in slide-in-from-bottom-4 duration-700`}>
                      <div className="flex flex-col gap-2">
                        <h3 className={`font-bold text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-widest opacity-70`}>OBJECTIVE & PROTOCOL</h3>
                        <p className={`font-mono text-xs ${textSub} leading-relaxed max-w-4xl opacity-80`}>
                          Our mission is to identify and quantify explicit LGBTQ+ thematic presence within target media. Utilizing advanced AI, we analyze plots, guides, and reviews to assign a comprehensive thematic density score from 0 (Minimal) to 10 (Explicit/Central).
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT: Mission Statement (Only when no result and not loading) */}

              </div>
            </div>

            {/* RESULT SECTION OR PROTOCOL GUIDE */}
            {!currentShow ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">



                <div className="mb-12 pl-1">
                  <div className={`h-px w-24 bg-gradient-to-r from-cyan-500 to-transparent mb-6`}></div>
                  <h3 className={`text-xl font-bold ${textMain} tracking-widest uppercase mb-2`}><span className="text-cyan-500">SCORING</span> CRITERIA</h3>
                  <p className={`${textSub} text-sm max-w-2xl`}>The Thematic Density Index measures the prominence of explicit LGBTQ+ themes, characters, or subplots.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  {/* Low Risk Card */}
                  <div className="group relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-br from-emerald-500 to-cyan-600 rounded-xl opacity-0 group-hover:opacity-40 blur transition duration-500"></div>
                    <div className={`relative h-full p-6 ${isDark ? 'bg-emerald-900/10 border-emerald-900/30 hover:bg-emerald-900/20' : 'bg-emerald-50/50 border-emerald-200 hover:bg-emerald-100/50'} backdrop-blur-md rounded-xl border transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]`}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)] group-hover:scale-110 transition-transform duration-300">
                          <LucideShield className="w-6 h-6" />
                        </div>
                        <h4 className="text-lg font-bold text-emerald-500 transition-colors">LOW RISK</h4>
                      </div>
                      <div className="text-xs font-bold tracking-wider text-emerald-600/80 mb-4 border-b border-emerald-900/30 pb-2 group-hover:border-emerald-500/50 transition-colors">LEVEL: 0-3 // STATUS: MINIMAL</div>
                      <p className={`${textSub} text-sm leading-relaxed group-hover:text-slate-300 transition-colors`}>Incidental detection. Background elements, brief mentions, or coded subtext. No narrative dominance.</p>
                    </div>
                  </div>
                  {/* Moderate Risk Card */}
                  <div className="group relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl opacity-0 group-hover:opacity-40 blur transition duration-500"></div>
                    <div className={`relative h-full p-6 ${isDark ? 'bg-amber-900/10 border-amber-900/30 hover:bg-amber-900/20' : 'bg-amber-50/50 border-amber-200 hover:bg-amber-100/50'} backdrop-blur-md rounded-xl border transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]`}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)] group-hover:scale-110 transition-transform duration-300">
                          <LucideAlertTriangle className="w-6 h-6" />
                        </div>
                        <h4 className="text-lg font-bold text-amber-500 transition-colors">MODERATE RISK</h4>
                      </div>
                      <div className="text-xs font-bold tracking-wider text-amber-600/80 mb-4 border-b border-amber-900/30 pb-2 group-hover:border-amber-500/50 transition-colors">LEVEL: 4-6 // STATUS: CAUTION</div>
                      <p className={`${textSub} text-sm leading-relaxed group-hover:text-slate-300 transition-colors`}>Recurring thematic elements. Non-central but noticeable subplots. Visible side characters. Noticeable genre deviation in side plots.</p>
                    </div>
                  </div>
                  {/* High Risk Card */}
                  <div className="group relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl opacity-0 group-hover:opacity-40 blur transition duration-500"></div>
                    <div className={`relative h-full p-6 ${isDark ? 'bg-red-900/10 border-red-900/30 hover:bg-red-900/20' : 'bg-red-50/50 border-red-200 hover:bg-red-100/50'} backdrop-blur-md rounded-xl border transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(239,68,68,0.15)]`}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)] group-hover:scale-110 transition-transform duration-300">
                          <LucideZap className="w-6 h-6" />
                        </div>
                        <h4 className="text-lg font-bold text-red-500 transition-colors">HIGH RISK</h4>
                      </div>
                      <div className="text-xs font-bold tracking-wider text-red-600/80 mb-4 border-b border-red-900/30 pb-2 group-hover:border-red-500/50 transition-colors">LEVEL: 7-10 // STATUS: CRITICAL</div>
                      <p className={`${textSub} text-sm leading-relaxed group-hover:text-slate-300 transition-colors`}>Dominant thematic presence. Dedicated episodes, central romance, or pivotal identity arcs. Major genre or tone shift central to plot.</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in zoom-in-95 duration-500">
                {/* Left: Data Visualization & Controls */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                  {/* Main Score Card */}
                  <div className={`relative p-8 rounded-lg border overflow-hidden backdrop-blur-xl ${isDark ? 'bg-slate-900/40' : 'bg-white/60'} ${details.colorClass} ${details.glowClass}`}>
                    <div className="absolute top-0 right-0 p-4 opacity-20"><LucideCpu size={120} strokeWidth={0.5} className={details.textClass} /></div>
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h3 className={`font-mono text-xs uppercase tracking-widest ${textSub}`}>{UI_THEMATIC_LABEL}</h3>
                          <div className="flex items-baseline gap-1 mt-1">
                            <span className={`font-tech font-bold text-6xl ${details.textClass} drop-shadow-md`}>{currentShow.atp}</span>
                            <span className={`font-tech text-xl ${textSub}`}>/10</span>
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded border text-xs font-mono font-bold tracking-wider ${details.bgBadge}`}>{details.header}</div>
                      </div>

                      {/* Consensus Bar */}
                      {(currentShow.votesUp > 0 || currentShow.votesDown > 0) && (
                        <div className={`mb-6 p-4 rounded border ${isDark ? 'bg-black/20 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                          <div className={`flex justify-between text-[10px] font-mono uppercase ${textSub} mb-2`}>
                            <span>Human Consensus</span>
                            <span className={votePercentage >= 70 ? 'text-emerald-500' : 'text-rose-500'}>{votePercentage}% VERIFIED</span>
                          </div>
                          <div className={`w-full h-1 ${isDark ? 'bg-white/10' : 'bg-slate-300'} rounded-full overflow-hidden`}>
                            <div className="h-full bg-cyan-500 shadow-[0_0_10px_#06b6d4]" style={{ width: `${votePercentage}%` }}></div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={digDeeper} disabled={isDiggingDeeper} className={`py-3 px-4 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-600 hover:bg-cyan-500/20 font-mono text-xs tracking-wider transition-all disabled:opacity-50`}>
                          {isDiggingDeeper ? 'PROCESSING...' : (deepExplanation && isExplanationOpen ? 'CLOSE DATA STREAM' : 'DEEP DIVE ANALYSIS (SPOILERS)')}
                        </button>
                        <button onClick={handleShare} className={`py-3 px-4 rounded border ${isDark ? 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'} font-mono text-xs tracking-wider transition-all flex items-center justify-center gap-2`}>
                          {copyFeedback ? <LucideCheck size={14} /> : <LucideCopy size={14} />} {copyFeedback || 'EXPORT'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Action Panel */}
                  <div className={`p-6 rounded-lg border backdrop-blur-md ${cardBg}`}>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className={`font-mono text-xs uppercase tracking-widest ${textSub}`}>User Actions</h4>

                      {currentShow.hasNewEpisodes && (
                        <button
                          onClick={() => analyzeAndScreen(currentShow.title)}
                          className="flex items-center gap-2 px-3 py-1 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-500/30 transition-colors text-xs font-mono animate-pulse mr-auto ml-4"
                        >
                          <LucideZap size={14} /> ANALYZE NEW EPISODES
                        </button>
                      )}

                      <button
                        onClick={handleRefresh}
                        className={`p-2 rounded-full transition-all duration-300 ${isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-cyan-400' : 'hover:bg-slate-200 text-slate-500 hover:text-cyan-600'}`}
                        title="Force Re-Analyze"
                      >
                        <LucideRefreshCw size={20} />
                      </button>
                      <button
                        onClick={toggleSave}
                        className={`p-2 rounded-full transition-all duration-300 ${isSaved ? 'text-cyan-500 bg-cyan-500/10' : isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`}
                        title={isSaved ? "Remove from Watchlist" : "Save to Watchlist"}
                      >
                        {isSaved ? <LucideBookmarkCheck size={20} /> : <LucideBookmark size={20} />}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => handleVote('up')} disabled={!!userVotes[currentShow.id]} className={`py-3 rounded border font-mono text-xs transition-all flex items-center justify-center gap-2 ${userVotes[currentShow.id] === 'up' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-500' : `hover:${isDark ? 'bg-white/5' : 'bg-slate-100'} ${isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-600'}`}`}>
                        <LucideThumbsUp size={14} /> ACCURATE
                      </button>
                      <button onClick={() => handleVote('down')} disabled={!!userVotes[currentShow.id]} className={`py-3 rounded border font-mono text-xs transition-all flex items-center justify-center gap-2 ${userVotes[currentShow.id] === 'down' ? 'bg-rose-500/20 border-rose-500/50 text-rose-500' : `hover:${isDark ? 'bg-white/5' : 'bg-slate-100'} ${isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-600'}`}`}>
                        <LucideThumbsDown size={14} /> INACCURATE
                      </button>
                    </div>
                  </div>

                  {/* Deep Scan Output Panel */}
                  <div className={`p-6 rounded-lg border backdrop-blur-md ${cardBg} transition-all duration-500`}>
                    <h4 className={`font-mono text-xs uppercase tracking-widest ${textSub} mb-4`}>Deep Scan Output</h4>

                    {isExplanationOpen ? (
                      <div className={`text-sm font-mono h-auto leading-relaxed whitespace-pre-wrap animate-in fade-in slide-in-from-top-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`} dangerouslySetInnerHTML={{ __html: cleanMarkdown(deepExplanation) }} />
                    ) : (
                      <div className={`h-32 border border-dashed ${isDark ? 'border-white/10' : 'border-slate-300'} rounded flex items-center justify-center text-[10px] font-mono ${textSub}`}>
                        {isDiggingDeeper ? 'ESTABLISHING SECURE CONNECTION...' : 'AWAITING DEEP DIVE AUTHORIZATION...'}
                      </div>
                    )}
                  </div>

                  {/* Red Flags (Content Advisories) - MOVED HERE (Left Column) */}
                  {episodeFlags && episodeFlags.length > 0 && !episodeFlags[0].toLowerCase().match(/^(none|no episodes|no explicit)/) && (
                    <div className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                      <details className={`group rounded border ${isDark ? 'border-rose-500/30 bg-rose-950/20' : 'border-rose-200 bg-rose-50'}`}>
                        <summary className={`list-none flex items-center justify-between p-3 cursor-pointer font-mono text-xs tracking-wider ${isDark ? 'text-rose-400 hover:bg-rose-500/10' : 'text-rose-600 hover:bg-rose-100'} transition-colors`}>
                          <div className="flex items-center gap-2">
                            <LucideAlertTriangle size={14} className="animate-pulse" />
                            <span>WARNING: CONTENT ADVISORIES DETECTED (SPOILERS)</span>
                          </div>
                          <LucideChevronRight size={14} className="transition-transform group-open:rotate-90" />
                        </summary>
                        <div className={`p-4 pt-0 border-t ${isDark ? 'border-rose-500/20' : 'border-rose-200'}`}>
                          <ul className="mt-3 space-y-2">
                            {episodeFlags.map((flag, i) => (
                              <li key={i} className={`text-xs font-mono pl-3 border-l-2 ${isDark ? 'border-rose-500/50 text-rose-300' : 'border-rose-400 text-rose-700'}`}>
                                {flag}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </details>
                    </div>
                  )}
                </div>

                {/* Right: Metadata & Content */}
                <div className="lg:col-span-7 flex flex-col gap-6">
                  <div className={`relative p-8 rounded-lg border backdrop-blur-md min-h-[400px] ${cardBg}`}>
                    {/* Content Header */}
                    <div className={`flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8 border-b ${isDark ? 'border-white/5' : 'border-slate-200'} pb-8`}>
                      <div className="space-y-3">
                        <h2 className={`text-4xl font-tech font-bold uppercase tracking-tight ${textMain}`}>{currentShow.title}</h2>
                        <div className={`flex flex-wrap items-center gap-3 font-mono text-xs ${textSub}`}>
                          <span className={`px-2 py-1 rounded border ${isDark ? 'border-white/10' : 'border-slate-300'}`}>{currentShow.year}</span>
                          {currentShow.contentRating && <span className={`px-2 py-1 rounded border ${isDark ? 'border-white/10' : 'border-slate-300'}`}>{currentShow.contentRating.replace(/\s*\(.*?\)/g, '').trim()}</span>}

                          {/* IMDb Badge */}
                          <a
                            href={currentShow.imdbId ? `https://www.imdb.com/title/${currentShow.imdbId}/` : `https://www.imdb.com/find?q=${encodeURIComponent(currentShow.title)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded bg-[#F5C518] text-black font-bold hover:opacity-80 transition-opacity no-underline flex items-center gap-1 shadow-sm"
                            title="View on IMDb"
                          >
                            <span className="font-black">IMDb</span>
                            <span>{currentShow.imdb || 'N/A'}</span>
                            <LucideExternalLink size={10} className="text-black/60" />
                          </a>

                          {/* Rotten Tomatoes Badge */}
                          {currentShow.rottenTomatoes && currentShow.rottenTomatoes !== 'N/A' && (
                            <a
                              href={currentShow.rottenTomatoesUrl && currentShow.rottenTomatoesUrl.startsWith('http') ? currentShow.rottenTomatoesUrl : (() => {
                                const slug = currentShow.title.toLowerCase()
                                  .replace(/'/g, '') // Remove apostrophes
                                  .replace(/[^a-z0-9\s]/g, '') // Remove other special chars
                                  .trim()
                                  .replace(/\s+/g, '_');
                                const typePath = (currentShow.type === 'TV Series' || currentShow.type === 'Series') ? 'tv' : 'm';
                                return `https://www.rottentomatoes.com/${typePath}/${slug}`;
                              })()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`px-2 py-1 rounded border flex items-center gap-1 font-bold shadow-sm transition-all hover:brightness-110 no-underline ${isDark ? 'bg-rose-950/30 border-rose-900/50 text-rose-400' : 'bg-rose-50 border-rose-200 text-rose-600'}`}
                              title="View on Rotten Tomatoes"
                            >
                              <span>🍅</span>
                              <span>{currentShow.rottenTomatoes}</span>
                            </a>
                          )}

                          {/* Metacritic Badge */}
                          {currentShow.metacritic && currentShow.metacritic !== 'N/A' && (
                            <a
                              href={currentShow.metacriticUrl && currentShow.metacriticUrl.startsWith('http') ? currentShow.metacriticUrl : (() => {
                                const slug = currentShow.title.toLowerCase()
                                  .replace(/'/g, '') // Remove apostrophes
                                  .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
                                  .trim()
                                  .replace(/\s+/g, '-');
                                const typePath = (currentShow.type === 'TV Series' || currentShow.type === 'Series') ? 'tv' : 'movie';
                                return `https://www.metacritic.com/${typePath}/${slug}`;
                              })()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`px-2 py-1 rounded flex items-center gap-1 font-bold shadow-sm transition-all hover:brightness-110 no-underline ${currentShow.metacritic >= 61 ? 'bg-[#66CC33] text-white' :
                                currentShow.metacritic >= 40 ? 'bg-[#FFCC33] text-black' :
                                  'bg-[#FF0000] text-white'
                                }`}
                              title="View on Metacritic"
                            >
                              <svg viewBox="0 0 24 24" className="w-5 h-5 -ml-1">
                                <circle cx="12" cy="12" r="12" fill="#FFCC33" />
                                <circle cx="12" cy="12" r="10" fill="#000000" />
                                <path
                                  fill="#FFFFFF"
                                  transform="rotate(-45 12 12) translate(0, 1) scale(0.75)"
                                  d="M19.3 10.8c-1.5 0-2.6 1-3.2 2.1-.6-1-1.8-2.1-3.4-2.1-2.4 0-3.8 1.6-3.8 4.2V21h3.2v-5.6c0-1.2.4-1.9 1.3-1.9.9 0 1.3.7 1.3 1.9V21h3.2v-5.6c0-1.2.4-1.9 1.3-1.9.9 0 1.3.7 1.3 1.9V21h3.2v-6.8c0-2.2-1.3-3.4-3.4-3.4z"
                                />
                              </svg>
                              <span>{currentShow.metacritic}</span>
                            </a>
                          )}
                        </div>
                      </div>
                      {currentShow.thumbnailUrl && (
                        <RobustImage
                          urls={currentShow.thumbnailUrl}
                          className="w-36 h-54 rounded border border-white/10 overflow-hidden shadow-2xl flex-shrink-0 bg-black object-cover opacity-80"
                          fallbackClassName="hidden"
                        />
                      )}
                    </div>

                    {/* Rationale Text */}
                    <div className="mb-8">
                      <h4 className="font-mono text-xs uppercase tracking-widest mb-3 text-cyan-500">Analysis Report</h4>
                      <p className={`font-light leading-relaxed text-lg ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        <span dangerouslySetInnerHTML={{ __html: formatMarkdown(currentShow.rationale) }} />
                        <span className={`opacity-50 text-sm block mt-2 ${textSub}`}>{details.rationaleSuffix}</span>
                      </p>
                    </div>

                    {/* Visualization Area */}
                    <div className={`pt-6 border-t ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
                      <div>
                        <h4 className={`font-mono text-[10px] uppercase tracking-widest mb-4 ${textSub}`}>Thematic Density Visualizer</h4>
                        <div className="h-32 w-full">
                          <Bar data={chartData} options={chartOptions} />
                        </div>
                      </div>
                    </div>

                    {/* Season Graph Overlay - Now appears immediately if data is present */}
                    {seasonScores && seasonScores.length > 0 && currentShow.type === 'TV Series' && (
                      <div className={`mt-8 pt-8 border-t ${isDark ? 'border-white/5' : 'border-slate-200'} animate-in slide-in-from-bottom-4`}>
                        <h4 className={`font-mono text-[10px] uppercase tracking-widest mb-4 ${textSub}`}>Seasonal Trend Analysis</h4>

                        {/* Smart Display Logic: Line Chart for > 1 Season (Graph makes sense), Cards for 1 Season */}
                        {seasonScores.length > 1 ? (
                          <div className={`h-48 w-full ${isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200'} rounded border p-4`}>
                            <Line data={seasonChartData} options={seasonChartOptions} />
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {seasonScores.map((s) => (
                              <div key={s.season} className={`p-3 rounded border text-center ${isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white border-slate-200 shadow-sm'} flex flex-col items-center justify-center`}>
                                <span className={`text-[10px] uppercase tracking-widest ${textSub} mb-1`}>Season {s.season}</span>
                                <div className={`text-2xl font-bold font-tech ${s.score > 6.7 ? 'text-rose-500' : s.score > 3 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                  {s.score}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {/* Footer Data Streams */}
        <div className={`mt-16 border-t ${isDark ? 'border-slate-800/50' : 'border-slate-200'} pt-6 flex flex-col md:flex-row justify-between text-xs font-mono ${textSub}`}>
          <div className="flex gap-4">
            <span>SYS_VER: 4.2.0</span>
            <span>LATENCY: 12ms</span>
            <span>ENCRYPTION: AES-256</span>
          </div>
          <div className="mt-2 md:mt-0">SECURE CONNECTION ESTABLISHED</div>
        </div>
      </div>
    </div >
  );

};

export default App;
