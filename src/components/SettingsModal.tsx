import { useState, useEffect } from 'react';
import { Key, Globe, ExternalLink, Check, X, ShieldCheck } from 'lucide-react';
import {
  getStoredApiKey,
  setStoredApiKey,
  getStoredEndpoint,
  setStoredEndpoint,
} from '../services/aholo';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [endpoint, setEndpoint] = useState('/api/aholo');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setApiKey(getStoredApiKey());
      setEndpoint(getStoredEndpoint());
      setSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    setStoredApiKey(apiKey.trim());
    setStoredEndpoint(endpoint);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-sans font-bold text-sm text-slate-100">
                Aholo API Settings
              </h3>
              <p className="text-[11px] text-slate-400">Manage credentials & cloud endpoint</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 text-xs">
          {/* API Key */}
          <div>
            <label className="block font-medium text-slate-200 mb-1 flex items-center justify-between">
              <span>Aholo API Key (Bearer Token)</span>
              <a
                href="https://labs.aholo3d.com/api-keys"
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:underline flex items-center gap-1 text-[11px]"
              >
                Get Key <ExternalLink className="w-3 h-3" />
              </a>
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your Aholo API key here..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              Stored client-side in localStorage and proxied securely.
            </p>
          </div>

          {/* Region / Endpoint */}
          <div>
            <label className="block font-medium text-slate-200 mb-1">
              Gateway Target Endpoint
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEndpoint('/api/aholo')}
                className={`p-2.5 rounded-lg border text-left transition ${
                  endpoint === '/api/aholo'
                    ? 'border-sky-400 bg-sky-950/40 text-sky-200'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-semibold flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> International
                </div>
                <div className="text-[10px] opacity-60 mt-0.5">api.aholo3d.com</div>
              </button>
              <button
                type="button"
                onClick={() => setEndpoint('https://api.aholo3d.cn')}
                className={`p-2.5 rounded-lg border text-left transition ${
                  endpoint === 'https://api.aholo3d.cn'
                    ? 'border-sky-400 bg-sky-950/40 text-sky-200'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-semibold flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> China Region
                </div>
                <div className="text-[10px] opacity-60 mt-0.5">api.aholo3d.cn</div>
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 transition flex items-center gap-1.5"
          >
            {saved ? (
              <>
                <Check className="w-3.5 h-3.5" /> Saved!
              </>
            ) : (
              'Save Credentials'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
