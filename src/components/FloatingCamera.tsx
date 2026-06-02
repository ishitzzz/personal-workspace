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

  // Permission warning states and sandbox error fallbacks
  const [permissionError, setPermissionError] = useState<string | null>(null);

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

  // Set camera streams in a single synchronized helper with sequential loading and tracking safety to prevent concurrent getUserMedia collisions
  useEffect(() => {
    let isActive = true;
    let localStream1: MediaStream | null = null;
    let localStream2: MediaStream | null = null;

    async function initCams() {
      if (!isCameraActive) {
        setCameraStream1(null);
        setCameraStream2(null);
        return;
      }

      // 1. Initialize Stream 1 (Face Cam) first
      try {
        const constraints1: MediaStreamConstraints = {
          video: activeDeviceId1 ? { deviceId: { exact: activeDeviceId1 }, width: 320, height: 240 } : { width: 320, height: 240 }
        };
        localStream1 = await navigator.mediaDevices.getUserMedia(constraints1);
        if (!isActive) {
          localStream1.getTracks().forEach(t => t.stop());
          return;
        }
        setCameraStream1(localStream1);
        setPermissionError(null);
      } catch (err) {
        console.warn('Could not request camera 1 stream with device constraints, falling back:', err);
        try {
          localStream1 = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
          if (!isActive) {
            localStream1.getTracks().forEach(t => t.stop());
            return;
          }
          setCameraStream1(localStream1);
          setPermissionError(null);
        } catch (fbErr) {
          console.error('Camera 1 fallback failed completely:', fbErr);
          setPermissionError(
            "Camera Blocked: Sandboxed iframe blocks hardware access, or permission was declined. Try clicking 'New Tab' at the outer top-right of your workspace to bypass Google AI Studio iframe constraints!"
          );
          setCameraStream1(null);
          setCameraStream2(null);
          return; // If we can't get even the primary camera, exit
        }
      }

      // 2. Initialize Stream 2 (Desk Cam) second (sequential, after Stream 1 succeeds)
      if (activeDeviceId2 && activeDeviceId2 !== '') {
        if (activeDeviceId2 === activeDeviceId1) {
          // If the cameras are the same, clone the first stream instead of opening a second getUserMedia flow
          if (localStream1 && isActive) {
            localStream2 = localStream1.clone();
            setCameraStream2(localStream2);
          }
        } else {
          try {
            const constraints2: MediaStreamConstraints = {
              video: { deviceId: { exact: activeDeviceId2 }, width: 320, height: 240 }
            };
            localStream2 = await navigator.mediaDevices.getUserMedia(constraints2);
            if (!isActive) {
              localStream2.getTracks().forEach(t => t.stop());
              return;
            }
            setCameraStream2(localStream2);
          } catch (err2) {
            console.warn('Could not launch secondary workspace camera feed, falling back to cloned visual feed:', err2);
            if (isActive && localStream1) {
              localStream2 = localStream1.clone();
              setCameraStream2(localStream2);
            }
          }
        }
      } else {
        setCameraStream2(null);
      }
    }

    initCams();

    return () => {
      isActive = false;
      if (localStream1) {
        localStream1.getTracks().forEach(t => t.stop());
      }
      if (localStream2) {
        localStream2.getTracks().forEach(t => t.stop());
      }
      setCameraStream1(null);
      setCameraStream2(null);
    };
  }, [isCameraActive, activeDeviceId1, activeDeviceId2]);

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
        setPermissionError(null);
        stream.getVideoTracks()[0].onended = () => {
          setScreenStream(null);
        };
      } catch (err) {
        console.warn('Screen sharing capture request rejected:', err);
        setPermissionError(
          "Screen Share Disallowed: Sandbox iframe policy blocked the 'display-capture' feature request. To stream your screen/slides, open this application in a 'New Tab' using the button in the top-right corner!"
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
        <div className="pt-0.5 space-y-2">
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

          {/* Sandbox inline help warnings */}
          {permissionError && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-200 p-2.5 rounded-lg text-[9.5px] font-mono leading-relaxed relative text-left">
              <p className="pr-4">{permissionError}</p>
              <button
                type="button"
                onClick={() => setPermissionError(null)}
                className="absolute top-1 right-2 text-amber-400 hover:text-white font-bold text-xs cursor-pointer"
                title="Dismiss warning"
              >
                ×
              </button>
            </div>
          )}
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
