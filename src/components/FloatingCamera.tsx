/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Camera, RefreshCw, X, Eye, Video, VideoOff, ScreenShare, Move } from 'lucide-react';

interface FloatingCameraProps {
  isCameraActive: boolean;
  onToggleCamera: () => void;
  aiAnalysisStatus: string;
  aiAnalysisSummary: string;
  lastAiCheck: string;
}

export default function FloatingCamera({
  isCameraActive,
  onToggleCamera,
  aiAnalysisStatus,
  aiAnalysisSummary,
  lastAiCheck,
}: FloatingCameraProps) {
  // Draggable Absolute Coordinates
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);

  // Multi camera state list
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId1, setActiveDeviceId1] = useState<string>(() => {
    return localStorage.getItem('aesthetic-room:active-device-id-1') || '';
  });
  const [activeDeviceId2, setActiveDeviceId2] = useState<string>(() => {
    return localStorage.getItem('aesthetic-room:active-device-id-2') || '';
  });

  const [cameraStream1, setCameraStream1] = useState<MediaStream | null>(null);
  const [cameraStream2, setCameraStream2] = useState<MediaStream | null>(null);

  const cameraVideoRef1 = useRef<HTMLVideoElement>(null);
  const cameraVideoRef2 = useRef<HTMLVideoElement>(null);

  // Screen Share stream state
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  // Enumerate camera devices
  useEffect(() => {
    async function getCameras() {
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        const cams = devs.filter(d => d.kind === 'videoinput');
        setDevices(cams);
        if (cams.length > 0) {
          const saved1 = localStorage.getItem('aesthetic-room:active-device-id-1');
          const saved2 = localStorage.getItem('aesthetic-room:active-device-id-2');

          if (saved1 && cams.some(c => c.deviceId === saved1)) {
            setActiveDeviceId1(saved1);
          } else {
            const defaultId = cams[0].deviceId;
            setActiveDeviceId1(defaultId);
            localStorage.setItem('aesthetic-room:active-device-id-1', defaultId);
          }

          if (saved2 && cams.some(c => c.deviceId === saved2)) {
            setActiveDeviceId2(saved2);
          } else if (cams.length > 1) {
            const secondId = cams[1].deviceId;
            setActiveDeviceId2(secondId);
            localStorage.setItem('aesthetic-room:active-device-id-2', secondId);
          } else {
            setActiveDeviceId2('');
          }
        }
      } catch (e) {
        console.warn('Could not enumerate video inputs:', e);
      }
    }
    getCameras();
  }, [isCameraActive]);

  const stream1Ref = useRef<MediaStream | null>(null);
  const stream2Ref = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Sync state streams with refs for reliable track-stopping access
  useEffect(() => {
    stream1Ref.current = cameraStream1;
  }, [cameraStream1]);

  useEffect(() => {
    stream2Ref.current = cameraStream2;
  }, [cameraStream2]);

  useEffect(() => {
    screenStreamRef.current = screenStream;
  }, [screenStream]);

  // Dynamic assignment of stream source to video nodes to bypass lifecycle latency bugs
  useEffect(() => {
    if (cameraVideoRef1.current) {
      cameraVideoRef1.current.srcObject = cameraStream1;
    }
  }, [cameraStream1, isCameraActive]);

  useEffect(() => {
    if (cameraVideoRef2.current) {
      cameraVideoRef2.current.srcObject = cameraStream2;
    }
  }, [cameraStream2, isCameraActive]);

  useEffect(() => {
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  // Set camera stream 1 helper with tracking safety
  useEffect(() => {
    let isActive = true;
    let stream: MediaStream | null = null;

    async function initStream1() {
      if (!isCameraActive) return;
      try {
        const constraints: MediaStreamConstraints = {
          video: activeDeviceId1 ? { deviceId: { exact: activeDeviceId1 }, width: 320, height: 240 } : { width: 320, height: 240 }
        };
        const s = await navigator.mediaDevices.getUserMedia(constraints);
        if (!isActive) {
          s.getTracks().forEach(t => t.stop());
          return;
        }
        stream = s;
        setCameraStream1(s);
      } catch (err) {
        console.warn('Could not request camera 1 stream with device constraints, falling back:', err);
        try {
          const s = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
          if (!isActive) {
            s.getTracks().forEach(t => t.stop());
            return;
          }
          stream = s;
          setCameraStream1(s);
        } catch (fbErr) {
          console.error('Camera 1 fallback failed completely:', fbErr);
        }
      }
    }

    initStream1();

    return () => {
      isActive = false;
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      setCameraStream1(null);
    };
  }, [isCameraActive, activeDeviceId1]);

  // Set camera stream 2 helper with anti-collision checks
  useEffect(() => {
    let isActive = true;
    let stream: MediaStream | null = null;

    async function initStream2() {
      // Do not open if secondary camera matches primary camera or is unconfigured
      if (!isCameraActive || !activeDeviceId2 || activeDeviceId2 === activeDeviceId1 || devices.length <= 1) {
        setCameraStream2(null);
        return;
      }
      try {
        const constraints: MediaStreamConstraints = {
          video: { deviceId: { exact: activeDeviceId2 }, width: 320, height: 240 }
        };
        const s = await navigator.mediaDevices.getUserMedia(constraints);
        if (!isActive) {
          s.getTracks().forEach(t => t.stop());
          return;
        }
        stream = s;
        setCameraStream2(s);
      } catch (err) {
        console.warn('Could not launch secondary workspace camera feed:', err);
        setCameraStream2(null);
      }
    }

    initStream2();

    return () => {
      isActive = false;
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      setCameraStream2(null);
    };
  }, [isCameraActive, activeDeviceId2, activeDeviceId1, devices.length]);

  // Toggle Screen Sharing helper
  const handleToggleScreenShare = async () => {
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
      setScreenStream(null);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true
        });
        setScreenStream(stream);
        stream.getVideoTracks()[0].onended = () => {
          setScreenStream(null);
        };
      } catch (err) {
        console.warn('Screen sharing capture request rejected:', err);
        alert(
          "Display sharing check: For permission inside sandbox layouts, make sure you authorized access. You can also open the workspace app in a 'New Tab' using the outer window button to bypass iframe limitations!"
        );
      }
    }
  };

  // Safe deep stop of all hardware and screen tracks on absolute component unmount
  useEffect(() => {
    return () => {
      if (stream1Ref.current) {
        stream1Ref.current.getTracks().forEach((track) => {
          try { track.stop(); } catch (e) {}
        });
      }
      if (stream2Ref.current) {
        stream2Ref.current.getTracks().forEach((track) => {
          try { track.stop(); } catch (e) {}
        });
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => {
          try { track.stop(); } catch (e) {}
        });
      }
      if (cameraVideoRef1.current) {
        cameraVideoRef1.current.srcObject = null;
      }
      if (cameraVideoRef2.current) {
        cameraVideoRef2.current.srcObject = null;
      }
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = null;
      }
    };
  }, []);

  // Mouse & touch draggable overlay bindings
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;

      const nextX = Math.max(0, Math.min(window.innerWidth - 320, dragRef.current.posX + dx));
      const nextY = Math.max(0, Math.min(window.innerHeight - 340, dragRef.current.posY + dy));

      setPosition({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      className="fixed w-76 bg-black/85 border border-white/10 backdrop-blur-2xl rounded-2xl shadow-[0_12px_44px_rgba(0,0,0,0.8)] z-50 overflow-hidden font-sans select-none flex flex-col justify-between"
    >
      {/* Draggable drag header bar */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between p-2.5 bg-neutral-900 border-b border-white/5 cursor-grab active:cursor-grabbing text-xs text-gray-200 font-semibold"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Move className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="truncate">Floating Focus Cam (Draggable)</span>
        </div>
        <button
          onClick={onToggleCamera}
          className="p-1 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Cam visuals grids */}
      <div className="p-3 space-y-2">
        {isCameraActive || screenStream ? (
          <div className="grid grid-cols-1 gap-2">
            {/* Primary active camera */}
            {isCameraActive && (
              <div className="relative aspect-video bg-neutral-900 rounded-lg overflow-hidden border border-white/10">
                <video
                  ref={cameraVideoRef1}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
                <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/75 text-[8px] font-mono uppercase text-gray-200">
                  Face Cam (Camera 1)
                </span>
              </div>
            )}

            {/* Screen Share panel stream */}
            {screenStream && (
              <div className="relative aspect-video bg-neutral-900 rounded-lg overflow-hidden border border-emerald-500/40">
                <video
                  ref={screenVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                />
                <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/75 text-[8px] font-mono uppercase text-emerald-400">
                  Shared Screen feed
                </span>
              </div>
            )}

            {/* Secondary independent camera */}
            {isCameraActive && cameraStream2 && (
              <div className="relative aspect-video bg-neutral-900 rounded-lg overflow-hidden border border-white/10">
                <video
                  ref={cameraVideoRef2}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
                <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/75 text-[8px] font-mono uppercase text-gray-200">
                  Desk Cam (Camera 2)
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="aspect-video bg-neutral-950 border border-white/5 rounded-lg flex flex-col items-center justify-center p-4 text-center space-y-2 text-xs">
            <Camera className="w-8 h-8 text-neutral-600 animate-pulse" />
            <div className="text-gray-400 font-semibold text-[11px]">Primary webcams dormant</div>
            <button
              onClick={onToggleCamera}
              className="bg-white hover:bg-gray-100 text-black px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
            >
              Start Cameras
            </button>
          </div>
        )}

        {/* Action button trigger screen sharing */}
        <div className="pt-0.5">
          <button
            onClick={handleToggleScreenShare}
            className={`w-full py-1.5 rounded-xl border flex items-center justify-center gap-1.5 transition-all text-[10px] font-mono uppercase font-semibold cursor-pointer ${
              screenStream 
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                : 'bg-black/30 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
            }`}
          >
            <ScreenShare className="w-3.5 h-3.5" />
            <span>{screenStream ? 'Disconnect Screen Share' : 'Start Screen Sharing'}</span>
          </button>
        </div>

        {/* Device config selects dropdowns */}
        {devices.length > 0 && isCameraActive && (
          <div className="grid grid-cols-2 gap-1.5 text-[9px] bg-black/40 p-1.5 rounded-lg border border-white/5 font-mono uppercase font-semibold">
            <div>
              <span className="text-gray-400 block mb-0.5">Cam 1:</span>
              <select
                value={activeDeviceId1}
                onChange={(e) => {
                  const val = e.target.value;
                  setActiveDeviceId1(val);
                  localStorage.setItem('aesthetic-room:active-device-id-1', val);
                }}
                className="w-full bg-neutral-900 border border-white/15 rounded text-[9px] text-white py-0.5 outline-none font-sans cursor-pointer focus:border-white/30"
              >
                {devices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera Input ${d.deviceId.slice(0, 4)}`}</option>
                ))}
              </select>
            </div>
            <div>
              <span className="text-gray-400 block mb-0.5">Cam 2 Desk:</span>
              <select
                value={activeDeviceId2}
                onChange={(e) => {
                  const val = e.target.value;
                  setActiveDeviceId2(val);
                  localStorage.setItem('aesthetic-room:active-device-id-2', val);
                }}
                className="w-full bg-neutral-900 border border-white/15 rounded text-[9px] text-white py-0.5 outline-none font-sans cursor-pointer focus:border-white/30"
              >
                <option value="">(None)</option>
                {devices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera Input ${d.deviceId.slice(0, 4)}`}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Vision tracker summary */}
        <div className="bg-black/40 border border-white/5 rounded-xl p-2.5 text-[11px] font-mono leading-relaxed space-y-1.5">
          <div className="flex items-center justify-between text-[9px] text-gray-400 uppercase font-bold">
            <span>OBSERVATION MONITOR</span>
            <span className="text-gray-500 font-bold">{lastAiCheck || '--:--'}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 font-semibold">Workspace Status:</span>
            <span className={`text-[10px] font-bold uppercase ${
              aiAnalysisStatus === 'working' ? 'text-emerald-400 animate-pulse' :
              aiAnalysisStatus === 'distracted' ? 'text-amber-400' :
              aiAnalysisStatus === 'away' ? 'text-red-400 font-semibold' : 'text-slate-300'
            }`}>
              {aiAnalysisStatus || 'idle'}
            </span>
          </div>

          <p className="text-gray-300 leading-snug italic text-[10px] bg-neutral-900/60 p-1.5 rounded-lg border border-white/5">
            "{aiAnalysisSummary || 'Study camera active & looking out'}"
          </p>
        </div>
      </div>
    </div>
  );
}
