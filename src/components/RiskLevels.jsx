import { Shield, AlertTriangle, Zap } from 'lucide-react';

export default function RiskLevels() {
    return (
        <div className="mt-16">
            <div className="text-center mb-10">
                <h2 className="text-xl font-tech font-bold text-cyan-500 tracking-[0.2em] mb-3">SCORING CRITERIA</h2>
                <div className="h-px w-32 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent mx-auto"></div>
                <p className="text-slate-400 mt-5 max-w-2xl mx-auto text-sm font-medium">
                    The Thematic Density Index measures the prominence of explicit LGBTQ+ themes, characters, or subplots.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Low Risk */}
                <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-xl relative overflow-hidden group hover:border-cyan-500/30 transition-all hover:shadow-[0_0_30px_rgba(6,182,212,0.1)]">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-cyan-400 to-cyan-600 shadow-[0_0_10px_rgba(6,182,212,0.5)]"></div>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-cyan-950/30 rounded-lg border border-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                            <Shield className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="font-tech font-bold text-2xl text-cyan-400 tracking-wide">LOW RISK</h3>
                            <div className="text-[10px] font-mono text-cyan-500/70 tracking-widest mt-1">LEVEL: 0-3 // STATUS: MINIMAL</div>
                        </div>
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed border-t border-slate-800/50 pt-4">
                        Incidental detection. Background elements, brief mentions, or coded subtext. No narrative dominance.
                    </p>
                </div>

                {/* Moderate Risk */}
                <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-xl relative overflow-hidden group hover:border-orange-500/30 transition-all hover:shadow-[0_0_30px_rgba(249,115,22,0.1)]">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-orange-400 to-orange-600 shadow-[0_0_10px_rgba(249,115,22,0.5)]"></div>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-orange-950/30 rounded-lg border border-orange-500/20 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.15)]">
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="font-tech font-bold text-2xl text-orange-400 tracking-wide">MODERATE RISK</h3>
                            <div className="text-[10px] font-mono text-orange-500/70 tracking-widest mt-1">LEVEL: 4-6 // STATUS: CAUTION</div>
                        </div>
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed border-t border-slate-800/50 pt-4">
                        Recurring thematic elements. Non-central but noticeable subplots. Visible side characters.
                    </p>
                </div>

                {/* High Risk */}
                <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-xl relative overflow-hidden group hover:border-red-500/30 transition-all hover:shadow-[0_0_30px_rgba(239,68,68,0.1)]">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-red-400 to-red-600 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-red-950/30 rounded-lg border border-red-500/20 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.15)]">
                            <Zap className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="font-tech font-bold text-2xl text-red-400 tracking-wide">HIGH RISK</h3>
                            <div className="text-[10px] font-mono text-red-500/70 tracking-widest mt-1">LEVEL: 7-10 // STATUS: CRITICAL</div>
                        </div>
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed border-t border-slate-800/50 pt-4">
                        Dominant thematic presence. Dedicated episodes, central romance, or pivotal identity arcs.
                    </p>
                </div>
            </div>
        </div>
    );
}
