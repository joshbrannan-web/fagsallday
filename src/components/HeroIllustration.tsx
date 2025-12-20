import React from 'react';

interface HeroIllustrationProps {
  className?: string;
}

const HeroIllustration: React.FC<HeroIllustrationProps> = ({ className }) => {
  return (
    <div className={`relative ${className}`}>
      <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
        {/* Sky gradient background */}
        <defs>
          <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(200, 80%, 75%)" />
            <stop offset="100%" stopColor="hsl(200, 70%, 90%)" />
          </linearGradient>
          <linearGradient id="grassGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(142, 50%, 45%)" />
            <stop offset="100%" stopColor="hsl(142, 60%, 35%)" />
          </linearGradient>
          <linearGradient id="fairwayGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(142, 55%, 50%)" />
            <stop offset="100%" stopColor="hsl(142, 50%, 40%)" />
          </linearGradient>
        </defs>

        {/* Sky */}
        <rect width="400" height="300" fill="url(#skyGradient)" />

        {/* Sun */}
        <circle cx="340" cy="60" r="30" fill="hsl(45, 100%, 70%)" opacity="0.9" />

        {/* Distant hills */}
        <ellipse cx="100" cy="200" rx="150" ry="40" fill="hsl(142, 35%, 55%)" />
        <ellipse cx="300" cy="195" rx="180" ry="50" fill="hsl(142, 40%, 50%)" />

        {/* Main fairway */}
        <path
          d="M0 220 Q100 180 200 200 Q300 220 400 190 L400 300 L0 300 Z"
          fill="url(#fairwayGradient)"
        />

        {/* Rough grass areas */}
        <path
          d="M0 250 Q50 240 100 255 Q150 270 200 260 Q250 250 300 265 Q350 280 400 270 L400 300 L0 300 Z"
          fill="url(#grassGradient)"
        />

        {/* Sand bunker */}
        <ellipse cx="280" cy="240" rx="35" ry="15" fill="hsl(45, 50%, 80%)" />

        {/* Flag and pole */}
        <line x1="180" y1="170" x2="180" y2="210" stroke="hsl(0, 0%, 30%)" strokeWidth="2" />
        <path d="M180 170 L205 178 L180 186 Z" fill="hsl(0, 70%, 55%)" />

        {/* Golf ball */}
        <circle cx="195" cy="205" r="5" fill="white" stroke="hsl(0, 0%, 80%)" strokeWidth="0.5" />

        {/* Trees on left */}
        <ellipse cx="50" cy="180" rx="30" ry="40" fill="hsl(142, 45%, 35%)" />
        <rect x="47" y="200" width="6" height="25" fill="hsl(25, 40%, 35%)" />

        {/* Trees on right */}
        <ellipse cx="360" cy="175" rx="35" ry="45" fill="hsl(142, 45%, 38%)" />
        <rect x="357" y="200" width="6" height="20" fill="hsl(25, 40%, 35%)" />

        {/* Club silhouette */}
        <g transform="translate(100, 230) rotate(-30)">
          <rect x="0" y="0" width="4" height="50" fill="hsl(0, 0%, 25%)" rx="1" />
          <ellipse cx="2" cy="-5" rx="12" ry="8" fill="hsl(0, 0%, 30%)" />
        </g>
      </svg>

      {/* Decorative elements */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3/4 h-4 bg-gradient-to-r from-transparent via-primary/20 to-transparent rounded-full blur-sm" />
    </div>
  );
};

export default HeroIllustration;
