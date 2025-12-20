import React, { CSSProperties } from 'react';

// Google CDN link format which bypasses the redirect issue
const BANNER_URL = "https://lh3.googleusercontent.com/d/1KlKDPrEL70d4H_u96oCVrIvuJvDIGhb3";

interface HeroIllustrationProps {
  className?: string;
}

const HeroIllustration: React.FC<HeroIllustrationProps> = ({ className }) => {
  const containerStyle: CSSProperties = {
    width: '100%',
    padding: '20px',
    boxSizing: 'border-box',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  };

  const imageStyle: CSSProperties = {
    width: '100%',
    maxWidth: '1200px',
    height: 'auto',
    borderRadius: '16px',
    boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
    display: 'block',
    objectFit: 'cover',
  };

  return (
    <div style={containerStyle} className={className}>
      <img
        src={BANNER_URL}
        alt="Golf Superheroes Banner"
        style={imageStyle}
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          console.error("Image failed to load. Check Google Drive permissions.");
        }}
      />
    </div>
  );
};

export default HeroIllustration;
