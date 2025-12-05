import clsx from 'clsx';

export default function MediaCard({ media }) {
    const isHighRisk = media.score >= 7;
    const isModerateRisk = media.score >= 4 && media.score < 7;
    const isLowRisk = media.score < 4;

    const borderColor = clsx({
        'border-cyan-500/50': isLowRisk,
        'border-orange-500/50': isModerateRisk,
        'border-red-500/50': isHighRisk,
    });

    const textColor = clsx({
        'text-cyan-500': isLowRisk,
        'text-orange-500': isModerateRisk,
        'text-red-500': isHighRisk,
    });

    const glowClass = clsx({
        'shadow-[0_0_20px_rgba(6,182,212,0.1)]': isLowRisk,
        'shadow-[0_0_20px_rgba(249,115,22,0.1)]': isModerateRisk,
        'shadow-[0_0_20px_rgba(239,68,68,0.1)]': isHighRisk,
    });

    return (
        <div className={`bg-slate-900 border ${borderColor} rounded-lg p-6 flex gap-6 ${glowClass} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
            <div className="w-32 h-48 bg-slate-800 rounded flex-shrink-0 overflow-hidden">
                <img src={media.poster} alt={media.title} className="w-full h-full object-cover opacity-80" />
            </div>

            <div className="flex-1">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="text-2xl font-bold text-white font-tech">{media.title}</h3>
                        <span className="text-slate-400 text-sm">{media.year} • {media.type}</span>
                    </div>
                    <div className={`text-4xl font-bold font-tech ${textColor}`}>
                        {media.score.toFixed(1)}
                    </div>
                </div>

                <div className={`inline-block px-2 py-1 rounded text-xs font-bold mb-4 bg-slate-950 border ${borderColor} ${textColor}`}>
                    RISK LEVEL: {media.riskLevel.toUpperCase()}
                </div>

                <p className="text-slate-300 text-sm leading-relaxed border-l-2 border-slate-700 pl-4">
                    {media.description}
                </p>
            </div>
        </div>
    );
}
