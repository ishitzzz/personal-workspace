/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SyllabusItem } from '../types';
import { FileText, Plus, ExternalLink, Trash2, Check, Video, Paperclip } from 'lucide-react';

interface SyllabusManagerProps {
  syllabusList: SyllabusItem[];
  onAddSyllabus: (name: string, type: 'pdf' | 'image' | 'link', sourceUrl: string) => void;
  onDeleteSyllabus: (id: string) => void;
}

export default function SyllabusManager({ syllabusList, onAddSyllabus, onDeleteSyllabus }: SyllabusManagerProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'pdf' | 'image' | 'link'>('link');
  const [sourceUrl, setSourceUrl] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddSyllabus(name, type, sourceUrl || 'https://example.com/mock-resource');
    setName('');
    setSourceUrl('');
    setUploadedFileName('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setName(file.name.replace(/\.[^/.]+$/, "")); // Auto label name

    // Auto set type
    if (file.type.includes('pdf')) {
      setType('pdf');
    } else if (file.type.includes('image')) {
      setType('image');
    } else {
      setType('link');
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSourceUrl(reader.result); // Encode to base64 Data URL for persistence
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-black/55 rounded-2xl border border-white/10 p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-200" />
          <div>
            <h3 className="text-sm font-semibold text-gray-100 uppercase tracking-wide">Syllabus & Material Resources</h3>
            <p className="text-[10px] text-gray-400">Attach study guides, syllabus PDFs, and work screenshots</p>
          </div>
        </div>
        <span className="text-[10px] font-mono text-gray-400 bg-white/5 py-0.5 px-2 rounded-full">
          {syllabusList.length} total item(s)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Input Form Column */}
        <form onSubmit={handleSubmit} className="space-y-3 bg-black/20 p-4 rounded-xl border border-white/5">
          <div className="space-y-1">
            <label className="text-[10px] text-gray-400 uppercase font-mono">Resource label</label>
            <input
              type="text"
              required
              placeholder="e.g. Advanced Calculus PDF Guide, Biology Syllabus"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black/45 border border-white/10 focus:border-white text-xs outline-none py-2 px-3 rounded-lg text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-gray-400 uppercase font-mono">Reference Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['link', 'pdf', 'image'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`py-1 rounded text-[10px] uppercase font-mono border transition-all cursor-pointer ${
                    type === t 
                      ? 'bg-white text-black font-semibold border-white' 
                      : 'bg-black/30 text-gray-400 border-white/10 hover:border-white/20'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-gray-400 uppercase font-mono">Source Link or Filepath</label>
            <input
              type="text"
              placeholder="Paste url or upload below..."
              value={sourceUrl && sourceUrl.startsWith('data:') ? 'Local Upload: ' + (uploadedFileName || 'Material File') : sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className="w-full bg-black/45 border border-white/10 focus:border-white text-xs outline-none py-2 px-3 rounded-lg text-white font-mono"
            />
          </div>

          <div className="space-y-1 pt-1 text-center">
            <div className="text-[9px] text-gray-500 uppercase font-mono">- OR UPLOAD MATERIAL FILE -</div>
            <div className="relative border border-dashed border-white/15 hover:border-white/30 rounded-xl p-3 text-center transition-all cursor-pointer bg-black/25 group mt-1">
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.txt,.csv"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Paperclip className="w-4 h-4 mx-auto text-gray-500 group-hover:text-white mb-1 transition-colors" />
              <div className="text-[10px] text-gray-300 font-mono font-medium truncate px-1">
                {uploadedFileName ? (
                  <span className="text-emerald-400">{uploadedFileName}</span>
                ) : (
                  "Choose PDF, Image or Doc"
                )}
              </div>
              <div className="text-[8px] text-gray-500 font-mono mt-0.5">Stored securely in your Cloud profile</div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-white hover:bg-gray-100 text-black font-semibold text-xs py-2 rounded-lg transition-colors cursor-pointer"
          >
            Attach syllabus asset
          </button>
        </form>

        {/* Visual List Column */}
        <div className="space-y-2 max-h-[196px] overflow-y-auto pr-1">
          {syllabusList.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-black/30 border border-white/10 text-gray-300">
                  <Paperclip className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-200 truncate pr-2">{item.name}</p>
                  <p className="text-[9px] text-gray-400 font-mono flex items-center gap-1.5 mt-0.5">
                    <span className="bg-white/10 px-1 py-0.2 rounded uppercase">{item.type}</span>
                    <span>Added: {new Date(item.addedAt).toLocaleDateString()}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  download={item.sourceUrl?.startsWith('data:') ? `${item.name}.${item.type === 'pdf' ? 'pdf' : item.type === 'image' ? 'png' : 'txt'}` : undefined}
                  className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                  title={item.sourceUrl?.startsWith('data:') ? 'Download original uploaded file' : 'Open resource link'}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => onDeleteSyllabus(item.id)}
                  className="p-1 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {syllabusList.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center py-10 text-gray-500 text-xs italic">
              No syllabus folders or screenshot resources added yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
