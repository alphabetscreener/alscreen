export const mockMediaDatabase = [
    {
        id: 'frankenstein-2025',
        title: 'Frankenstein',
        year: 2025,
        type: 'Movie',
        score: 2.5,
        riskLevel: 'Low',
        description: 'A modern reimagining of the classic tale. Contains subtextual themes of identity and otherness that parallel queer experiences, but no explicit LGBTQ+ characters or plotlines.',
        poster: 'https://placehold.co/400x600/1e293b/cbd5e1?text=Frankenstein',
    },
    {
        id: 'tlou-ep3',
        title: 'The Last of Us: Episode 3',
        year: 2023,
        type: 'TV Episode',
        score: 9.0,
        riskLevel: 'High',
        description: 'Features a central, explicit romantic relationship between two male characters (Bill and Frank). The entire narrative arc of the episode focuses on their life together.',
        poster: 'https://placehold.co/400x600/1e293b/cbd5e1?text=TLOU',
    },
    {
        id: 'heartstopper',
        title: 'Heartstopper',
        year: 2022,
        type: 'TV Series',
        score: 10.0,
        riskLevel: 'High',
        description: 'A coming-of-age series centered entirely around a romance between two teen boys. LGBTQ+ themes are the primary focus of the show.',
        poster: 'https://placehold.co/400x600/1e293b/cbd5e1?text=Heartstopper',
    },
    {
        id: 'top-gun',
        title: 'Top Gun',
        year: 1986,
        type: 'Movie',
        score: 1.2,
        riskLevel: 'Low',
        description: 'Often cited for homoerotic subtext in volleyball scenes and male bonding, but contains no explicit LGBTQ+ content or intent.',
        poster: 'https://placehold.co/400x600/1e293b/cbd5e1?text=Top+Gun',
    }
];

export const searchMedia = (query) => {
    if (!query) return [];
    const lowerQuery = query.toLowerCase();
    return mockMediaDatabase.filter(item =>
        item.title.toLowerCase().includes(lowerQuery)
    );
};
