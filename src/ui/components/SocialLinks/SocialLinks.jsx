import './SocialLinks.css';

const SOCIAL_CONFIG = {
    instagram: { icon: '📸', label: 'Instagram', color: '#E1306C', baseUrl: 'https://instagram.com/' },
    facebook: { icon: '📘', label: 'Facebook', color: '#1877F2', baseUrl: 'https://facebook.com/' },
    linkedin: { icon: '💼', label: 'LinkedIn', color: '#0A66C2', baseUrl: 'https://linkedin.com/in/' },
    tiktok: { icon: '🎵', label: 'TikTok', color: '#000000', baseUrl: 'https://tiktok.com/@' },
    twitter: { icon: '🐦', label: 'Twitter / X', color: '#1DA1F2', baseUrl: 'https://x.com/' },
    youtube: { icon: '▶️', label: 'YouTube', color: '#FF0000', baseUrl: 'https://youtube.com/' },
};

function isSafeUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
        return false;
    }
}

function normalizeUrl(platform, value) {
    if (!value) return null;
    if (value.startsWith('http://') || value.startsWith('https://')) {
        return isSafeUrl(value) ? value : null;
    }
    const handle = value.replace('@', '');
    const base = SOCIAL_CONFIG[platform]?.baseUrl;
    return base ? `${base}${handle}` : null;
}

export default function SocialLinks({ profiles = {}, size = 'md', showEmpty = false }) {
    const platforms = Object.keys(SOCIAL_CONFIG);
    const entries = platforms
        .map(key => ({ key, value: profiles[key], ...SOCIAL_CONFIG[key] }))
        .filter(e => showEmpty || e.value);

    if (entries.length === 0 && !showEmpty) return null;

    return (
        <div className={`social-links social-links--${size}`}>
            {entries.map(e => {
                const url = normalizeUrl(e.key, e.value);
                return (
                    <a
                        key={e.key}
                        href={url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`social-link ${!e.value ? 'social-link--empty' : ''}`}
                        title={e.value ? `${e.label}: ${e.value}` : `${e.label}: não informado`}
                    >
                        <span className="social-link__icon">{e.icon}</span>
                        <span className="social-link__label">{e.label}</span>
                        {e.value && <span className="social-link__handle">{e.value}</span>}
                    </a>
                );
            })}
            {/* Other URLs */}
            {profiles.otherSocialUrls?.filter((item) => item?.url && isSafeUrl(item.url)).map((item, i) => (
                <a
                    key={`other-${i}`}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="social-link"
                    title={item.label || item.url}
                >
                    <span className="social-link__icon">🔗</span>
                    <span className="social-link__label">{item.label || 'Outro'}</span>
                    <span className="social-link__handle">{item.url}</span>
                </a>
            ))}
        </div>
    );
}
