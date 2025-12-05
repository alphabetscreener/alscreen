import { Activity, Archive, Sun, Moon, LogIn, LogOut, User } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Navbar({ user, onSignIn, onSignOut, onViewArchive, savedCount = 0, onHome, isDark, setIsDark }) {
    // Local state removed in favor of props

    // Effect to toggle class on document element
    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDark]);

    return (
        <nav className="flex items-center justify-between py-6 px-12 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
            <div className="flex items-center gap-6 cursor-pointer" onClick={onHome}>
                <div className="p-2.5 bg-cyan-950/30 rounded-lg border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.15)] group">
                    <Activity className="w-7 h-7 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold font-tech tracking-wider text-white mb-0.5">
                        ALPHABET <span className="text-cyan-500 font-extrabold text-2xl mx-1">//</span> SCREENER
                    </h1>
                    <p className="text-[10px] text-slate-400 tracking-[0.3em] font-bold uppercase ml-1">ADVANCED CONTENT ANALYSIS & THEMATIC SCREENING</p>
                </div>
            </div>

            <div className="flex items-center gap-6">
                {/* Auth Status / Sign In */}
                {(!user || user.isAnonymous) ? (
                    <button
                        onClick={onSignIn}
                        className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/50 rounded-md text-cyan-400 hover:bg-cyan-500/20 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all text-xs font-bold tracking-wider"
                    >
                        <LogIn className="w-4 h-4" />
                        <span>SIGN IN</span>
                    </button>
                ) : (
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-md">
                            {user.photoURL ? (
                                <img src={user.photoURL} alt="Profile" className="w-6 h-6 rounded-full border border-slate-600" />
                            ) : (
                                <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center border border-slate-600">
                                    <User className="w-4 h-4 text-slate-400" />
                                </div>
                            )}
                            <div className="flex flex-col">
                                <span className="text-[10px] text-slate-400 font-bold leading-none mb-0.5">CONNECTED</span>
                                <span className="text-xs text-cyan-400 font-bold leading-none" title={user.email || user.displayName || 'User'}>
                                    {(user.email || user.displayName || 'User').length > 5
                                        ? (user.email || user.displayName || 'User').substring(0, 5) + '...'
                                        : (user.email || user.displayName || 'User')}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={onSignOut}
                            className="p-2 rounded-md border border-slate-700/50 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition-all"
                            title="Sign Out"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                )}

                <div className="h-8 w-px bg-slate-800/50 mx-2"></div>

                <button
                    onClick={onViewArchive}
                    className="flex items-center gap-3 px-5 py-2.5 bg-slate-900/80 border border-slate-700/50 rounded-md text-slate-300 hover:text-cyan-400 hover:border-cyan-500/30 transition-all text-xs font-bold tracking-wider group"
                >
                    <Archive className="w-4 h-4 text-slate-500 group-hover:text-cyan-500 transition-colors" />
                    <span>SAVED ARCHIVE</span>
                    <span className="bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-[10px] ml-1 text-slate-400 group-hover:text-cyan-400 group-hover:border-cyan-500/30 transition-colors">{savedCount}</span>
                </button>

                <button
                    onClick={() => setIsDark(!isDark)}
                    className="p-2.5 bg-slate-900/80 border border-slate-700/50 rounded-md text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all"
                >
                    {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
            </div>
        </nav>
    );
}
