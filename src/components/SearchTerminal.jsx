import { Search, Dices } from 'lucide-react';
import { useState } from 'react';

export default function SearchTerminal({ onSearch }) {
    const [query, setQuery] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onSearch(query);
    };

    return (
        <div className="w-full max-w-5xl mx-auto mb-16 relative">
            {/* Corner Accents */}
            <div className="absolute -top-4 -left-4 w-8 h-8 border-t-2 border-l-2 border-cyan-500/30"></div>
            <div className="absolute -top-4 -right-4 w-8 h-8 border-t-2 border-r-2 border-cyan-500/30"></div>
            <div className="absolute -bottom-4 -left-4 w-8 h-8 border-b-2 border-l-2 border-cyan-500/30"></div>
            <div className="absolute -bottom-4 -right-4 w-8 h-8 border-b-2 border-r-2 border-cyan-500/30"></div>

            <div className="flex items-center gap-2 mb-6 text-cyan-500">
                <span className="text-xl font-bold font-tech">&gt;_</span>
                <h2 className="text-sm font-bold tracking-[0.2em] font-tech text-slate-300">CONTENT ANALYSIS TERMINAL</h2>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-8 backdrop-blur-md shadow-2xl">
                <div className="bg-slate-950/50 border border-slate-800/50 rounded p-4 mb-8 font-mono text-sm text-slate-400 leading-relaxed">
                    <p className="mb-2"><span className="text-slate-500 font-bold">MISSION:</span> Analyze media for <span className="text-cyan-400 font-bold">Explicit LGBTQ+ Thematic Presence</span>.</p>
                    <p className="text-slate-500">Our AI scans plot summaries, parental guides, and reviews to grade thematic density from 0 (None) to 10 (Central/Explicit).</p>
                </div>

                <form onSubmit={handleSubmit} className="flex gap-4">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-500 transition-colors w-6 h-6" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Enter Title or IMDb Link..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-5 pl-14 pr-4 text-lg text-slate-200 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all placeholder:text-slate-700 font-medium"
                        />
                    </div>

                    <button
                        type="submit"
                        className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-bold font-tech tracking-wider px-10 rounded-lg transition-all shadow-[0_0_20px_rgba(234,88,12,0.3)] hover:shadow-[0_0_30px_rgba(234,88,12,0.5)] flex items-center gap-2 text-lg"
                    >
                        INITIATE SCAN &gt;
                    </button>

                    <button
                        type="button"
                        className="px-6 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:border-slate-600 transition-all hover:bg-slate-700"
                        title="Random Scan"
                    >
                        <Dices className="w-6 h-6" />
                    </button>
                </form>
            </div>
        </div>
    );
}
