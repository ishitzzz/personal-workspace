/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { StudyChannel } from '../types';

// Extract 11-character YouTube video ID safely
function extractYouTubeIdLocal(urlOrId: string): string {
  if (!urlOrId) return '';
  const trimmed = urlOrId.trim();
  if (trimmed.includes('v=')) {
    const parts = trimmed.split('v=');
    if (parts[1]) {
      const id = parts[1].split('&')[0];
      if (id.length === 11) return id;
    }
  }
  if (trimmed.includes('youtu.be/')) {
    const parts = trimmed.split('youtu.be/');
    if (parts[1]) {
      const id = parts[1].split(/[?#]/)[0];
      if (id.length === 11) return id;
    }
  }
  if (trimmed.includes('embed/')) {
    const parts = trimmed.split('embed/');
    if (parts[1]) {
      const id = parts[1].split(/[?#]/)[0];
      if (id.length === 11) return id;
    }
  }
  return trimmed.length === 11 ? trimmed : trimmed.substring(0, 11);
}

// Singleton script promise to load YouTube API once globally
let ytApiPromise: Promise<void> | null = null;
function loadYoutubeApi(): Promise<void> {
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise<void>((resolve) => {
    // If already loaded
    if ((window as any).YT && (window as any).YT.Player) {
      resolve();
      return;
    }

    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const prevCallback = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      if (prevCallback) prevCallback();
      resolve();
    };

    // Backup check if callback isn't fired but YT is loaded in window
    const interval = setInterval(() => {
      if ((window as any).YT && (window as any).YT.Player) {
        clearInterval(interval);
        resolve();
      }
    }, 200);
  });

  return ytApiPromise;
}

interface YoutubeEmbedSlotProps {
  idx: number;
  vidId: string;
  cleanIds: string[];
  displayName: string;
}

// Dedicated state-retaining YouTube Player node
const YoutubeEmbedSlot = React.memo(({ idx, vidId, cleanIds, displayName }: YoutubeEmbedSlotProps) => {
  const containerId = `yt-player-slot-${idx}`;
  const playerRef = useRef<any>(null);
  const checkIntervalRef = useRef<any>(null);
  const initializedKeyRef = useRef<string>('');
  const currentIndexStateRef = useRef<number>(0);

  // Read initial playlist index from localStorage for elegant UI count tracking
  const [currentIndexState, setCurrentIndexState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`aesthetic-room:node-state-${idx}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.index === 'number') {
          return parsed.index;
        }
      }
    } catch (e) {}
    return 0;
  });

  useEffect(() => {
    currentIndexStateRef.current = currentIndexState;
  }, [currentIndexState]);

  useEffect(() => {
    let isMounted = true;
    let player: any = null;

    const currentKey = `${idx}-${vidId}-${cleanIds.join(',')}`;
    if (initializedKeyRef.current === currentKey && playerRef.current) {
      return;
    }

    const initPlayer = async () => {
      await loadYoutubeApi();
      if (!isMounted) return;

      // Unmount previous slot player if key fundamentally changed
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch (e) {}
        playerRef.current = null;
      }

      let savedIndex = 0;
      let savedTime = 11; // default fallback start offset

      try {
        const saved = localStorage.getItem(`aesthetic-room:node-state-${idx}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          
          const matchIdx = cleanIds.indexOf(parsed.videoId);
          if (matchIdx !== -1) {
            savedIndex = matchIdx;
          } else if (parsed.index < cleanIds.length) {
            savedIndex = parsed.index;
          }
          if (typeof parsed.time === 'number') {
            savedTime = parsed.time;
          }
        }
      } catch (e) {
        console.warn('Failed restoring channel video state for node:', idx, e);
      }

      if (currentIndexStateRef.current !== savedIndex) {
        setCurrentIndexState(savedIndex);
        currentIndexStateRef.current = savedIndex;
      }

      const activeVid = cleanIds[savedIndex] || vidId;
      initializedKeyRef.current = currentKey;

      try {
        player = new (window as any).YT.Player(containerId, {
          height: '100%',
          width: '100%',
          videoId: activeVid,
          playerVars: {
            autoplay: 1,
            mute: 1,
            controls: 0,
            showinfo: 0,
            rel: 0,
            iv_load_policy: 3,
            start: savedTime,
            playsinline: 1,
            playlist: cleanIds.join(','),
            loop: 1
          },
          events: {
            onReady: (event: any) => {
              if (!isMounted) return;
              event.target.mute();
              event.target.playVideo();

              if (savedIndex > 0 && cleanIds.length > 1) {
                try {
                  event.target.playVideoAt(savedIndex);
                } catch (e) {}
              }
            },
            onStateChange: (event: any) => {
              // Event state 0 is ENDED inside YT Player API
              if (event.data === 0 && cleanIds.length > 1) {
                try {
                  const currentIndex = event.target.getPlaylistIndex();
                  const playlistLength = cleanIds.length;
                  const nextIdx = (currentIndex + 1) % playlistLength;
                  event.target.playVideoAt(nextIdx);
                  if (currentIndexStateRef.current !== nextIdx) {
                    setCurrentIndexState(nextIdx);
                    currentIndexStateRef.current = nextIdx;
                    window.dispatchEvent(new CustomEvent('aesthetic-room:node-index-updated', {
                      detail: { nodeIdx: idx, index: nextIdx }
                    }));
                  }
                } catch (e) {
                  try {
                    event.target.nextVideo();
                  } catch (err) {}
                }
              }
            }
          }
        });

        playerRef.current = player;

        // Periodic state-saving loop every 6 seconds (only saves to localStorage, avoids state spam)
        if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = setInterval(() => {
          if (player && typeof player.getPlayerState === 'function') {
            const state = player.getPlayerState();
            if (state === 1) {
              try {
                const time = player.getCurrentTime();
                let index = 0;
                try {
                  index = player.getPlaylistIndex();
                } catch (e) {}
                
                if (index < 0 || index === undefined || index === null) {
                  index = 0;
                }

                if (currentIndexStateRef.current !== index) {
                  setCurrentIndexState(index);
                  currentIndexStateRef.current = index;
                  window.dispatchEvent(new CustomEvent('aesthetic-room:node-index-updated', {
                    detail: { nodeIdx: idx, index: index }
                  }));
                }

                const currentVidId = cleanIds[index] || vidId;

                localStorage.setItem(
                  `aesthetic-room:node-state-${idx}`,
                  JSON.stringify({
                    videoId: currentVidId,
                    index: index,
                    time: Math.floor(time)
                  })
                );
              } catch (err) {
                // Ignore transient frame warnings
              }
            }
          }
        }, 6000);

      } catch (err) {
        console.warn('Failed instantiating YT element player for index:', idx, err);
      }
    };

    initPlayer();

    return () => {
      isMounted = false;
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      if (playerRef.current && initializedKeyRef.current !== currentKey) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
        playerRef.current = null;
      }
    };
  }, [vidId, JSON.stringify(cleanIds), idx]);

  useEffect(() => {
    const handleRemoteChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.nodeIdx === idx) {
        const action = customEvent.detail.action;
        if (playerRef.current && cleanIds.length > 1) {
          try {
            const length = cleanIds.length;
            let targetIdx = currentIndexStateRef.current;
            if (action === 'next') {
              targetIdx = (currentIndexStateRef.current + 1) % length;
            } else if (action === 'prev') {
              targetIdx = (currentIndexStateRef.current - 1 + length) % length;
            }
            playerRef.current.playVideoAt(targetIdx);
            setCurrentIndexState(targetIdx);
            currentIndexStateRef.current = targetIdx;
            window.dispatchEvent(new CustomEvent('aesthetic-room:node-index-updated', {
              detail: { nodeIdx: idx, index: targetIdx }
            }));
            localStorage.setItem(
              `aesthetic-room:node-state-${idx}`,
              JSON.stringify({
                videoId: cleanIds[targetIdx],
                index: targetIdx,
                time: 0
              })
            );
          } catch (err) {
            console.warn('Remote video switch failed:', err);
          }
        }
      }
    };

    window.addEventListener('aesthetic-room:change-node-index', handleRemoteChange);
    return () => {
      window.removeEventListener('aesthetic-room:change-node-index', handleRemoteChange);
    };
  }, [idx, JSON.stringify(cleanIds)]);

  return (
    <div className="absolute inset-0 w-full h-full bg-slate-950 select-none">
      <div id={containerId} className="absolute inset-0 w-full h-full scale-[1.08] pointer-events-none" />
      
      {/* Node label overlay (sleek absolute positioning) */}
      <div className="absolute bottom-2 left-2 flex flex-row items-center gap-1.5 z-20 pointer-events-none">
        <span className="bg-black/85 border border-zinc-800 px-2 py-0.5 rounded text-[9px] font-mono tracking-wider text-neutral-200 uppercase shadow-md select-none">
          Cam Node {idx + 1}: {displayName}
        </span>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.idx === nextProps.idx &&
         prevProps.vidId === nextProps.vidId &&
         prevProps.displayName === nextProps.displayName &&
         prevProps.cleanIds.length === nextProps.cleanIds.length &&
         prevProps.cleanIds.every((id, i) => id === nextProps.cleanIds[i]);
});

interface BackgroundGridProps {
  gridVideos: string[];
  activeGridCount: number;
  channels: StudyChannel[];
}

const BackgroundGrid = React.memo(({ gridVideos, activeGridCount, channels }: BackgroundGridProps) => {
  return (
    <div 
      className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden bg-slate-950"
    >
      <div className={`grid w-full h-full gap-1.5 p-1.5 transition-all duration-300 ${
        activeGridCount === 1 ? 'grid-cols-1 grid-rows-1' :
        activeGridCount === 2 ? 'grid-cols-2 grid-rows-1' :
        activeGridCount === 3 ? 'grid-cols-3 grid-rows-1' :
        activeGridCount === 4 ? 'grid-cols-2 grid-rows-2' :
        'grid-cols-3 grid-rows-2' // 5 or 6 cameras option
      }`}>
        {Array.from({ length: activeGridCount }).map((_, idx) => {
          const assignedChannel = channels?.find(c => c.assignedNode === idx + 1);
          
          let vidId = '';
          let cleanIds: string[] = [];
          let displayName = '';
          
          if (assignedChannel && assignedChannel.videoIds && assignedChannel.videoIds.length > 0) {
            cleanIds = assignedChannel.videoIds.map(extractYouTubeIdLocal).filter(Boolean);
            if (cleanIds.length > 0) {
              vidId = cleanIds[0];
              displayName = `${assignedChannel.name} (${cleanIds.length} streams loop)`;
            } else {
              const fallbackVid = gridVideos[idx] || '4xDzrIxZZZI';
              vidId = extractYouTubeIdLocal(fallbackVid);
              cleanIds = [vidId];
              displayName = `Slot ${idx + 1} Empty`;
            }
          } else {
            const rawVid = gridVideos[idx] || '4xDzrIxZZZI';
            vidId = extractYouTubeIdLocal(rawVid);
            cleanIds = [vidId];
            displayName = `Manual slot loop: ${vidId}`;
          }

          return (
            <div key={`video-grid-node-${idx}`} className="relative w-full h-full bg-slate-950 overflow-hidden rounded-lg">
              <YoutubeEmbedSlot
                idx={idx}
                vidId={vidId}
                cleanIds={cleanIds}
                displayName={displayName}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.activeGridCount === nextProps.activeGridCount &&
         JSON.stringify(prevProps.gridVideos) === JSON.stringify(nextProps.gridVideos) &&
         JSON.stringify(prevProps.channels) === JSON.stringify(nextProps.channels);
});

export default BackgroundGrid;
