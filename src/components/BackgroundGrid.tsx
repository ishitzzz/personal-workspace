/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

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

interface BackgroundGridProps {
  gridVideos: string[];
  activeGridCount: number;
}

const BackgroundGrid = React.memo(({ gridVideos, activeGridCount }: BackgroundGridProps) => {
  return (
    <div 
      className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden bg-slate-950"
    >
      <div className={`grid w-full h-full gap-1.5 p-1.5 transition-all duration-300 ${
        activeGridCount === 1 ? 'grid-cols-1 grid-rows-1' :
        activeGridCount === 2 ? 'grid-cols-2 grid-rows-1' :
        activeGridCount === 3 ? 'grid-cols-3 grid-rows-1' :
        'grid-cols-2 grid-rows-2' // max 4 streams as requested
      }`}>
        {gridVideos.slice(0, activeGridCount).map((rawVid, idx) => {
          const vidId = extractYouTubeIdLocal(rawVid);
          return (
            <div key={`${vidId}-${idx}`} className="relative w-full h-full bg-slate-950 overflow-hidden rounded-lg">
              <iframe
                id={`pure-nocookie-yt-iframe-${idx}`}
                src={`https://www.youtube-nocookie.com/embed/${vidId}?autoplay=1&mute=1&playlist=${vidId}&loop=1&controls=0&showinfo=0&rel=0&iv_load_policy=3&start=11&playsinline=1`}
                className="absolute inset-0 w-full h-full scale-[1.08]"
                allow="autoplay; encrypted-media"
                title={`Ambience stream element ${idx}`}
              />
              <span className="absolute bottom-2 left-2 bg-black/85 border border-white/10 px-2 py-0.5 rounded text-[9px] font-mono tracking-wider text-neutral-200 uppercase shadow-md z-15">
                Cam Node {idx + 1}: {vidId}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render when the video ids list or active count actually changes
  return prevProps.activeGridCount === nextProps.activeGridCount &&
         JSON.stringify(prevProps.gridVideos) === JSON.stringify(nextProps.gridVideos);
});

export default BackgroundGrid;
