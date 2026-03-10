import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { SpotDetail } from '../types/database.types';
import './SpotBottomSheet.css';

interface SpotBottomSheetProps {
    spotName: string;
    spotDetail: SpotDetail | null;
    onClose: () => void;
    isVisible: boolean;
    isLoading?: boolean;
}

const SpotBottomSheet: React.FC<SpotBottomSheetProps> = ({ spotName, spotDetail, onClose, isVisible, isLoading = false }) => {
    const [activeTab, setActiveTab] = useState<'FISHING' | 'CAMPING'>('FISHING');

    const parseInfo = (info: any) => {
        if (!info) return null;
        if (typeof info === 'string') {
            try {
                const parsed = JSON.parse(info);
                if (typeof parsed === 'object' && parsed !== null) return parsed;
                return { rawText: info };
            } catch {
                return { rawText: info }; // Standard string
            }
        }
        return info; // Already an object
    };

    const fishingData = spotDetail ? parseInfo(spotDetail.fishing_info) : null;
    const campingData = spotDetail ? parseInfo(spotDetail.camping_info) : null;

    // Default active tab to whatever info is available if one is missing
    React.useEffect(() => {
        if (spotDetail) {
            if (!fishingData && campingData) setActiveTab('CAMPING');
            if (!campingData && fishingData) setActiveTab('FISHING');
        }
    }, [spotDetail, fishingData, campingData]);

    if (!isVisible) return null;

    const modalContent = (
        <div className="spot-bottom-sheet-overlay" onClick={onClose} style={{
            position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', transition: 'opacity 0.3s ease'
        }}>
            <div
                className="spot-bottom-sheet-container"
                onClick={(e) => e.stopPropagation()}
                style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
                    boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5)', height: '70vh', display: 'flex', flexDirection: 'column',
                    animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                }}
            >
                {/* Drag Handle */}
                <div className="flex justify-center pt-4 pb-2" onClick={onClose} style={{ cursor: 'pointer' }}>
                    <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.3)', borderRadius: '4px' }}></div>
                </div>

                {/* Header */}
                <div className="px-6 flex items-start justify-between pb-4 pt-2">
                    <div>
                        <div className="flex items-center gap-2 mb-1 text-cyan-400 text-xs font-bold tracking-widest uppercase">
                            <span className="material-symbols-outlined text-sm">explore</span>
                            <span>Spot Details</span>
                        </div>
                        <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">{spotName}</h1>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.05)' }}
                        className="size-9 flex items-center justify-center rounded-full text-slate-300 hover:text-white hover:bg-slate-700/50 transition-all"
                    >
                        <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                </div>

                {/* Tabs */}
                {(fishingData || campingData) && (
                    <div className="px-4 border-b border-white/5 flex gap-2">
                        <button
                            className={`flex-1 py-3 text-sm font-bold transition-all rounded-t-lg relative ${activeTab === 'FISHING' ? 'text-cyan-400 bg-white/5' : 'text-slate-400 hover:text-slate-200'}`}
                            onClick={() => setActiveTab('FISHING')}
                            disabled={!fishingData}
                            style={{ opacity: !fishingData ? 0.3 : 1 }}
                        >
                            <span className="flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined text-lg">Phishing</span>
                                Fishing
                            </span>
                            {activeTab === 'FISHING' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]"></div>}
                        </button>
                        <button
                            className={`flex-1 py-3 text-sm font-bold transition-all rounded-t-lg relative ${activeTab === 'CAMPING' ? 'text-emerald-400 bg-white/5' : 'text-slate-400 hover:text-slate-200'}`}
                            onClick={() => setActiveTab('CAMPING')}
                            disabled={!campingData}
                            style={{ opacity: !campingData ? 0.3 : 1 }}
                        >
                            <span className="flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined text-lg">Camping</span>
                                Camping
                            </span>
                            {activeTab === 'CAMPING' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]"></div>}
                        </button>
                    </div>
                )}

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full p-8 space-y-4">
                            <div className="relative size-12">
                                <div className="absolute inset-0 rounded-full border-2 border-slate-700"></div>
                                <div className="absolute inset-0 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin"></div>
                            </div>
                            <p className="text-slate-400 text-sm animate-pulse">Loading spot details...</p>
                        </div>
                    ) : spotDetail && (fishingData || campingData) ? (
                        activeTab === 'FISHING' && fishingData ? (
                            <div className="space-y-6 animate-fade-in">
                                {fishingData.rawText ? (
                                    <div className="p-5 rounded-xl bg-slate-800/40 border border-slate-700/50 backdrop-blur-md">
                                        <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{fishingData.rawText}</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* AI Summary / Strategy */}
                                        {(spotDetail.summary || fishingData.tips) && (
                                            <div className="p-5 rounded-xl bg-gradient-to-br from-cyan-950/40 to-slate-900/40 border border-cyan-500/20 relative overflow-hidden">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2"></div>
                                                <div className="flex items-center gap-2 mb-3 relative z-10">
                                                    <span className="material-symbols-outlined text-cyan-400 text-lg">smart_toy</span>
                                                    <h4 className="text-cyan-400 text-sm font-bold uppercase tracking-widest">AI Insights</h4>
                                                </div>
                                                <p className="text-slate-200 text-sm leading-relaxed mb-4 relative z-10 font-medium">
                                                    {spotDetail.summary}
                                                </p>
                                                {fishingData.tips && (
                                                    <p className="text-slate-400 text-xs leading-relaxed whitespace-pre-wrap relative z-10 italic">
                                                        " {fishingData.tips} "
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* Target Species & Baits (Grid) */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 backdrop-blur-md">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="material-symbols-outlined text-cyan-400 text-sm">Tsunami</span>
                                                    <h4 className="text-slate-300 text-xs font-bold uppercase tracking-wider">Target Species</h4>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(fishingData.target_species || fishingData.species)?.map((species: string) => (
                                                        <span key={species} className="px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 rounded-md text-cyan-300 text-xs">{species}</span>
                                                    ))}
                                                    {!(fishingData.target_species?.length || fishingData.species?.length) && <span className="text-slate-500 text-xs">정보 없음</span>}
                                                </div>
                                            </div>

                                            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 backdrop-blur-md">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="material-symbols-outlined text-amber-400 text-sm">Bug_Report</span>
                                                    <h4 className="text-slate-300 text-xs font-bold uppercase tracking-wider">Best Baits</h4>
                                                </div>
                                                <p className="text-slate-300 text-sm leading-tight">
                                                    {fishingData.recommended_baits?.join(', ') || fishingData.recommend_bait || '정보 없음'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Recommended Gear */}
                                        {(fishingData.recommended_gear || fishingData.recommend_gear) && (
                                            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 backdrop-blur-md">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="material-symbols-outlined text-purple-400 text-sm">fishing_hook</span>
                                                    <h4 className="text-slate-300 text-xs font-bold uppercase tracking-wider">Recommended Gear</h4>
                                                </div>
                                                <p className="text-slate-300 text-sm leading-relaxed">
                                                    {fishingData.recommended_gear || fishingData.recommend_gear}
                                                </p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        ) : activeTab === 'CAMPING' && campingData ? (
                            <div className="space-y-6 animate-fade-in">
                                {campingData.rawText ? (
                                    <div className="p-5 rounded-xl bg-slate-800/40 border border-slate-700/50 backdrop-blur-md">
                                        <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{campingData.rawText}</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Facilities */}
                                        <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 backdrop-blur-md">
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="material-symbols-outlined text-emerald-400 text-sm">deck</span>
                                                <h4 className="text-slate-300 text-xs font-bold uppercase tracking-wider">Facilities & Amenities</h4>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {campingData.facilities?.map((fac: string) => (
                                                    <span key={fac} className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-300 text-xs font-medium">{fac}</span>
                                                ))}
                                                {!campingData.facilities?.length && <span className="text-slate-500 text-sm">정보 없음</span>}
                                            </div>
                                        </div>

                                        {/* Floor Type & Env */}
                                        <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 backdrop-blur-md flex justify-between items-center">
                                            <div>
                                                <h4 className="text-slate-400 text-xs uppercase tracking-wider mb-1">Floor Environment</h4>
                                                <p className="text-slate-200 font-medium">{campingData.floor_type || '알 수 없음'}</p>
                                            </div>
                                            {campingData.price_range && (
                                                <div className="text-right">
                                                    <h4 className="text-slate-400 text-xs uppercase tracking-wider mb-1">Est. Price</h4>
                                                    <p className="text-amber-400 font-bold">{campingData.price_range}</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Recipes */}
                                        {campingData.recipes && campingData.recipes.length > 0 && (
                                            <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-950/40 to-slate-900/40 border border-emerald-500/20 relative overflow-hidden">
                                                <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
                                                <div className="flex items-center gap-2 mb-4 relative z-10">
                                                    <span className="material-symbols-outlined text-emerald-400 text-lg">local_dining</span>
                                                    <h4 className="text-emerald-400 text-sm font-bold uppercase tracking-widest">Camp Recipe Ideas</h4>
                                                </div>
                                                <div className="space-y-4 relative z-10">
                                                    {campingData.recipes.map((recipe: any, idx: number) => (
                                                        <div key={idx} className="border-l-2 border-emerald-500/30 pl-3">
                                                            <p className="text-slate-100 font-bold text-sm mb-1">{recipe.name}</p>
                                                            <p className="text-slate-400 text-xs leading-relaxed">{recipe.desc}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        ) : null
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full p-8 space-y-4">
                            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'rgba(255,255,255,0.1)' }}>cloud_off</span>
                            <p className="text-slate-400 text-sm text-center">선택하신 장소의 상세 팁(AI 데이터)을 <br />수집하는 중입니다.</p>
                        </div>
                    )}
                </div>
            </div>
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-fade-in {
                    animation: fadeIn 0.3s ease-out forwards;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.1);
                    border-radius: 4px;
                }
            `}</style>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default SpotBottomSheet;
