
import { useState } from 'react';

// 1. Mock Data
interface Review {
    id: string;
    nickname: string;
    date: string;
    photoUrl: string;
    content: string;
    likes: number;
}

const MOCK_REVIEWS: Review[] = [
    {
        id: 'r1',
        nickname: '캠핑조아',
        date: '2024.01.28',
        photoUrl: 'https://picsum.photos/400/300?random=1',
        content: '쓰레기 싹 치우고 갑니다! 다음 분들도 깨끗하게 이용해주세요 😊',
        likes: 12
    },
    {
        id: 'r2',
        nickname: '낚시왕김낚시',
        date: '2024.01.25',
        photoUrl: 'https://picsum.photos/400/300?random=2',
        content: '도다리 3마리 잡고 포인트 청소 완료 인증샷!',
        likes: 8
    },
    {
        id: 'r3',
        nickname: '자연사랑',
        date: '2024.01.20',
        photoUrl: 'https://picsum.photos/400/300?random=3',
        content: '가져온 쓰레기는 되가져가기 실천중입니다.',
        likes: 24
    }
];

interface CleanupReviewSectionProps {
    placeId: string; // Not used for now (Mock mode)
}

const CleanupReviewSection = ({ placeId: _placeId }: CleanupReviewSectionProps) => {
    const [reviews, setReviews] = useState<Review[]>(MOCK_REVIEWS);
    const [isWriting, setIsWriting] = useState(false);

    // New Review Form State
    const [newContent, setNewContent] = useState('');
    const [previewImg, setPreviewImg] = useState<string | null>(null);

    const handleLike = (id: string) => {
        setReviews(prev => prev.map(r =>
            r.id === id ? { ...r, likes: r.likes + 1 } : r
        ));
    };

    const handlePhotoSelect = () => {
        // Simulation
        const randomImg = `https://picsum.photos/400/300?random=${Date.now()}`;
        setPreviewImg(randomImg);
    };

    const handleSubmit = () => {
        if (!newContent.trim()) {
            alert("내용을 입력해주세요!");
            return;
        }

        const newReview: Review = {
            id: `new_${Date.now()}`,
            nickname: '나', // Default
            date: new Date().toLocaleDateString(),
            photoUrl: previewImg || 'https://picsum.photos/400/300?random=99',
            content: newContent,
            likes: 0
        };

        setReviews([newReview, ...reviews]);
        setIsWriting(false);
        setNewContent('');
        setPreviewImg(null);
        alert('소중한 인증 후기가 등록되었습니다! 👏');
    };

    return (
        <div style={{ marginTop: '24px', borderTop: '8px solid #F3F4F6', paddingTop: '20px', marginLeft: '-16px', marginRight: '-16px', paddingLeft: '16px', paddingRight: '16px' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                    청소 인증 & 방문 후기 <span style={{ color: '#2563EB' }}>{reviews.length}</span>
                </h4>
                <button
                    onClick={() => setIsWriting(!isWriting)}
                    style={{
                        background: 'transparent',
                        border: '1px solid #D1D5DB',
                        borderRadius: '20px',
                        padding: '6px 12px',
                        fontSize: '13px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer'
                    }}
                >
                    📷 인증 쓰기
                </button>
            </div>

            {/* Write Form */}
            {isWriting && (
                <div style={{ background: '#F9FAFB', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                    <div style={{ marginBottom: '12px' }}>
                        <button
                            onClick={handlePhotoSelect}
                            style={{ width: '100%', height: '140px', background: '#E5E7EB', borderRadius: '8px', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundImage: previewImg ? `url(${previewImg})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}
                        >
                            {!previewImg && (
                                <>
                                    <span style={{ fontSize: '24px' }}>📷</span>
                                    <span style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>사진 추가하기</span>
                                </>
                            )}
                        </button>
                    </div>
                    <textarea
                        value={newContent}
                        onChange={(e) => setNewContent(e.target.value)}
                        placeholder="이곳의 청소 인증이나 생생한 후기를 남겨주세요."
                        style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '10px', fontSize: '14px', minHeight: '80px', resize: 'none', outline: 'none' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px', gap: '8px' }}>
                        <button
                            onClick={() => setIsWriting(false)}
                            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#E5E7EB', color: '#374151', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                            취소
                        </button>
                        <button
                            onClick={handleSubmit}
                            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#2563EB', color: 'white', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                            등록
                        </button>
                    </div>
                </div>
            )}

            {/* List (Horizontal Scroll) */}
            <div style={{
                display: 'flex',
                gap: '12px',
                overflowX: 'auto',
                paddingBottom: '16px',
                // Hide scrollbar but allow scrolling
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
            }}>
                <style>
                    {`
                        div::-webkit-scrollbar { 
                            display: none; 
                        }
                    `}
                </style>
                {reviews.map(review => (
                    <div key={review.id} style={{
                        flex: '0 0 280px', // Fixed width for horizontal items
                        display: 'flex',
                        flexDirection: 'column',
                        background: 'white',
                        border: '1px solid #E5E7EB',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        padding: '12px'
                    }}>
                        {/* User Info */}
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ width: '24px', height: '24px', background: '#E0E7FF', borderRadius: '50%', marginRight: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                                👤
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#1F2937' }}>{review.nickname}</span>
                                <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{review.date}</span>
                            </div>
                        </div>

                        {/* Photo (Main) */}
                        <div
                            style={{
                                width: '100%',
                                height: '200px',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                marginBottom: '10px',
                                backgroundImage: `url(${review.photoUrl})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                backgroundColor: '#F3F4F6'
                            }}
                        />

                        {/* Content */}
                        <p style={{
                            fontSize: '14px',
                            color: '#374151',
                            lineHeight: '1.4',
                            margin: '0 0 10px 0',
                            whiteSpace: 'pre-wrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            height: '40px' // Fixed height for 2 lines
                        }}>
                            {review.content}
                        </p>

                        {/* Action Btn */}
                        <div style={{ marginTop: 'auto' }}>
                            <button
                                onClick={() => handleLike(review.id)}
                                style={{
                                    background: '#F9FAFB',
                                    border: '1px solid #E5E7EB',
                                    color: review.likes > 0 ? '#2563EB' : '#6B7280',
                                    padding: '4px 10px',
                                    borderRadius: '16px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    width: '100%',
                                    justifyContent: 'center'
                                }}
                            >
                                👍 도움이 돼요 {review.likes}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

        </div>
    );
};

export default CleanupReviewSection;
