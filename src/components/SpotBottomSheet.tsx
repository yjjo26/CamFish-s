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

/**
 * Safely parse info field — handles JSON object, JSON string, or plain text.
 * Returns: { type: 'object', data: Record<string, any> } | { type: 'text', data: string } | null
 */
const safeParse = (info: any): { type: 'object'; data: Record<string, any> } | { type: 'text'; data: string } | null => {
    if (info === null || info === undefined) return null;

    // Already a non-null object (Supabase returns parsed JSON)
    if (typeof info === 'object' && !Array.isArray(info)) {
        if (Object.keys(info).length === 0) return null;
        return { type: 'object', data: info };
    }

    // Array — render as text
    if (Array.isArray(info)) {
        const text = info.join(', ');
        return text.length > 0 ? { type: 'text', data: text } : null;
    }

    // String — try to parse as JSON first
    if (typeof info === 'string') {
        const trimmed = info.trim();
        if (trimmed.length === 0) return null;

        try {
            const parsed = JSON.parse(trimmed);
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                if (Object.keys(parsed).length === 0) return null;
                return { type: 'object', data: parsed };
            }
            // parsed was a primitive or array
            return { type: 'text', data: String(parsed) };
        } catch {
            // Not valid JSON — treat as raw text
            return { type: 'text', data: trimmed };
        }
    }

    // Fallback for numbers, booleans, etc.
    return { type: 'text', data: String(info) };
};

/**
 * Prettify a JSON key for display: snake_case → Title Case
 */
const prettifyKey = (key: string): string => {
    return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
};

/**
 * Render a single value — handles string, array, nested object, etc.
 */
const renderValue = (value: any): React.ReactNode => {
    if (value === null || value === undefined) return <span className="spot-no-info">-</span>;

    // Array of strings/numbers
    if (Array.isArray(value)) {
        if (value.length === 0) return <span className="spot-no-info">-</span>;

        // If array of objects (e.g. recipes), render each
        if (typeof value[0] === 'object') {
            return (
                <div className="spot-nested-list">
                    {value.map((item, idx) => (
                        <div key={idx} className="spot-nested-item">
                            {typeof item === 'object' ? (
                                Object.entries(item).map(([k, v]) => (
                                    <div key={k} className="spot-nested-row">
                                        <span className="spot-nested-key">{prettifyKey(k)}</span>
                                        <span className="spot-nested-val">{String(v)}</span>
                                    </div>
                                ))
                            ) : (
                                <span>{String(item)}</span>
                            )}
                        </div>
                    ))}
                </div>
            );
        }

        // Array of primitives → tag list
        return (
            <div className="spot-tag-list">
                {value.map((item, idx) => (
                    <span key={idx} className="spot-tag cyan">{String(item)}</span>
                ))}
            </div>
        );
    }

    // Nested object
    if (typeof value === 'object') {
        return (
            <div className="spot-nested-list">
                {Object.entries(value).map(([k, v]) => (
                    <div key={k} className="spot-nested-row">
                        <span className="spot-nested-key">{prettifyKey(k)}</span>
                        <span className="spot-nested-val">{String(v)}</span>
                    </div>
                ))}
            </div>
        );
    }

    // String / number / boolean
    return <p className="spot-text-value">{String(value)}</p>;
};

const SpotBottomSheet: React.FC<SpotBottomSheetProps> = ({ spotName, spotDetail, onClose, isVisible, isLoading = false }) => {
    const [activeTab, setActiveTab] = useState<'FISHING' | 'CAMPING'>('FISHING');

    const fishingParsed = spotDetail ? safeParse(spotDetail.fishing_info) : null;
    const campingParsed = spotDetail ? safeParse(spotDetail.camping_info) : null;

    // Auto-select available tab
    React.useEffect(() => {
        if (spotDetail) {
            if (!fishingParsed && campingParsed) setActiveTab('CAMPING');
            if (!campingParsed && fishingParsed) setActiveTab('FISHING');
        }
    }, [spotDetail, fishingParsed, campingParsed]);

    if (!isVisible) return null;

    /** Render any parsed info dynamically */
    const renderDynamicContent = (parsed: NonNullable<ReturnType<typeof safeParse>>, theme: 'fishing' | 'camping') => {
        // Case 1: Plain text fallback
        if (parsed.type === 'text') {
            return (
                <div className="spot-raw-text">
                    <p>{parsed.data}</p>
                </div>
            );
        }

        // Case 2: JSON object — iterate all keys dynamically
        // Filter out technical/internal fields that aren't user-facing
        const EXCLUDED_KEYS = new Set(['embedding', 'id', 'spot_id', 'created_at', 'updated_at', 'vector', 'metadata']);
        const entries = Object.entries(parsed.data).filter(([key]) => !EXCLUDED_KEYS.has(key.toLowerCase()));

        return (
            <>
                {/* AI Summary card if `summary` exists on the spotDetail */}
                {spotDetail?.summary && (
                    <div className={`spot-ai-card ${theme === 'camping' ? 'camping-theme' : ''}`}>
                        <div className={`spot-ai-card-glow ${theme}`} />
                        <div className="spot-ai-label">
                            <span className="material-symbols-outlined spot-ai-label-icon">smart_toy</span>
                            <span className="spot-ai-label-text">AI Insights</span>
                        </div>
                        <p className="spot-ai-summary">{spotDetail.summary}</p>
                    </div>
                )}

                {/* Dynamic Key-Value Cards in a grid */}
                <div className="spot-dynamic-grid">
                    {entries.map(([key, value]) => (
                        <div key={key} className="spot-dynamic-card">
                            <div className="spot-info-card-header">
                                <span className={`material-symbols-outlined spot-info-card-icon ${theme === 'fishing' ? 'cyan' : 'emerald'}`}>
                                    info
                                </span>
                                <span className="spot-info-card-title">{prettifyKey(key)}</span>
                            </div>
                            <div className="spot-dynamic-value">
                                {renderValue(value)}
                            </div>
                        </div>
                    ))}
                </div>
            </>
        );
    };

    const modalContent = (
        <div className="spot-overlay" onClick={onClose}>
            <div className="spot-container" onClick={(e) => e.stopPropagation()}>
                {/* Handle */}
                <div className="spot-handle" onClick={onClose}>
                    <div className="spot-handle-bar" />
                </div>

                {/* Header */}
                <div className="spot-header">
                    <div className="spot-header-left">
                        <div className="spot-header-badge">
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>explore</span>
                            <span>Spot Details</span>
                        </div>
                        <h1 className="spot-header-title">{spotName}</h1>
                    </div>
                    <button className="spot-close-btn" onClick={onClose}>✕</button>
                </div>

                {/* Tabs — only show if at least one info exists */}
                {(fishingParsed || campingParsed) && (
                    <div className="spot-tabs">
                        <button
                            className={`spot-tab-btn fishing ${activeTab === 'FISHING' ? 'active' : ''} ${!fishingParsed ? 'disabled' : ''}`}
                            onClick={() => fishingParsed && setActiveTab('FISHING')}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>Phishing</span>
                            Fishing
                            {activeTab === 'FISHING' && <div className="spot-tab-indicator fishing" />}
                        </button>
                        <button
                            className={`spot-tab-btn camping ${activeTab === 'CAMPING' ? 'active' : ''} ${!campingParsed ? 'disabled' : ''}`}
                            onClick={() => campingParsed && setActiveTab('CAMPING')}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>Camping</span>
                            Camping
                            {activeTab === 'CAMPING' && <div className="spot-tab-indicator camping" />}
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="spot-scroll-content">
                    {isLoading ? (
                        <div className="spot-loading">
                            <div className="spot-spinner-wrap">
                                <div className="spot-spinner-bg" />
                                <div className="spot-spinner-fg" />
                            </div>
                            <p className="spot-loading-text">데이터를 불러오는 중...</p>
                        </div>
                    ) : spotDetail && (fishingParsed || campingParsed) ? (
                        <div className="spot-section">
                            {activeTab === 'FISHING' && fishingParsed
                                ? renderDynamicContent(fishingParsed, 'fishing')
                                : null}
                            {activeTab === 'CAMPING' && campingParsed
                                ? renderDynamicContent(campingParsed, 'camping')
                                : null}
                        </div>
                    ) : (
                        <div className="spot-empty">
                            <span className="material-symbols-outlined spot-empty-icon">cloud_off</span>
                            <p className="spot-empty-text">
                                선택하신 장소의 상세 팁(AI 데이터)이<br />아직 등록되지 않았습니다.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default SpotBottomSheet;
