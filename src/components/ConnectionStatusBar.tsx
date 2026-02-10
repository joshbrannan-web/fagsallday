import React, { useState, useEffect, useRef } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { offlineStorage } from '@/services/offlineStorage';

const ConnectionStatusBar: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [showBackOnline, setShowBackOnline] = useState(false);
  const wasOfflineRef = useRef(false);
  const pendingSyncCount = offlineStorage.getPendingSyncCount();

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
    } else if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      setShowBackOnline(true);
      const timer = setTimeout(() => setShowBackOnline(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  if (isOnline && !showBackOnline && pendingSyncCount === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex justify-center pointer-events-none">
      <div
        className={`
          pointer-events-auto px-4 py-1.5 rounded-b-lg text-xs font-medium flex items-center gap-2 shadow-md
          transition-all duration-300 ease-in-out
          ${!isOnline 
            ? 'bg-destructive text-destructive-foreground' 
            : showBackOnline 
              ? 'bg-primary text-primary-foreground animate-pulse' 
              : 'bg-muted text-muted-foreground'}
        `}
      >
        {!isOnline ? (
          <>
            <WifiOff className="w-3.5 h-3.5" />
            <span>Offline</span>
            {pendingSyncCount > 0 && (
              <span className="bg-destructive-foreground/20 rounded-full px-1.5 text-[10px]">
                {pendingSyncCount} pending
              </span>
            )}
          </>
        ) : showBackOnline ? (
          <>
            <Wifi className="w-3.5 h-3.5" />
            <span>Back online</span>
          </>
        ) : pendingSyncCount > 0 ? (
          <>
            <Wifi className="w-3.5 h-3.5" />
            <span>Syncing {pendingSyncCount} changes...</span>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default ConnectionStatusBar;
