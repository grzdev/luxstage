import { useState, useEffect } from 'react';
import {
  getStoredApiKey,
  setStoredApiKey,
  getStoredEndpoint,
  setStoredEndpoint,
  hasConfiguredApiKey,
} from '../services/aholo';
import { SmoothScrollArea } from './SmoothScrollArea';

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

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isKeyConfigured = hasConfiguredApiKey();

  const handleSave = () => {
    setStoredApiKey(apiKey.trim());
    setStoredEndpoint(endpoint);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 500);
  };

  return (
    <div
      className={`lux-modal-backdrop ${isOpen ? 'open' : ''}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="lux-modal"
        style={{ maxWidth: 480 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="lux-modal-header">
          <div className="lux-modal-title-wrap">
            <div className="lux-modal-icon-badge">⚙</div>
            <div>
              <div className="lux-modal-title">Aholo API Settings</div>
              <div className="lux-modal-subtitle">
                Manage cloud generative credentials & gateway endpoint
              </div>
            </div>
          </div>
          <button
            type="button"
            className="lux-modal-close-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <SmoothScrollArea className="lux-modal-body">
          {apiKey.trim() ? (
            <div
              style={{
                background: 'rgba(14, 165, 233, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 11.5,
                color: 'var(--ink)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <span>✦ Custom Aholo API key entered (will override default server key).</span>
              <button
                type="button"
                onClick={() => {
                  setApiKey('');
                  setStoredApiKey('');
                }}
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '3px 8px',
                  fontSize: 10.5,
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Clear Key
              </button>
            </div>
          ) : isKeyConfigured ? (
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 11.5,
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>✓</span>
              <span>Default LuxStage cloud API key is active — or paste your own key below to use your personal quota.</span>
            </div>
          ) : null}

          {/* API Key */}
          <div>
            <div className="lux-section-label" style={{ marginBottom: 6 }}>
              <span>Your Aholo API Key (Optional Override):</span>
              <a
                href="https://www.aholo.ai/hackathon"
                target="_blank"
                rel="noreferrer"
                style={{ color: '#38bdf8', fontSize: 11, textDecoration: 'underline' }}
              >
                Get Aholo Key ↗
              </a>
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={isKeyConfigured ? 'Leave blank to use default key, or paste your own Aholo key…' : 'Paste your Aholo API key here...'}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'var(--bg)',
                border: '1.5px solid var(--border-2)',
                borderRadius: 8,
                padding: '10px 12px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                color: 'var(--ink)',
                outline: 'none',
              }}
            />
            <div
              style={{
                fontSize: 11,
                color: 'var(--muted)',
                marginTop: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>🔒</span> Stored in your browser and proxied securely to <code>api.aholo.ai</code>.
            </div>
          </div>

          {/* Region Endpoint Selector */}
          <div>
            <div className="lux-section-label" style={{ marginBottom: 6 }}>
              <span>Target Gateway Endpoint:</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                onClick={() => setEndpoint('/api/aholo')}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border:
                    endpoint === '/api/aholo'
                      ? '1.5px solid #38bdf8'
                      : '1px solid var(--border)',
                  background:
                    endpoint === '/api/aholo'
                      ? 'rgba(14, 165, 233, 0.12)'
                      : 'var(--surface-2)',
                  color: endpoint === '/api/aholo' ? '#38bdf8' : 'var(--muted)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 12 }}>🌐 International</div>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>api.aholo.ai (/global/lux3d/v1)</div>
              </button>

              <button
                type="button"
                onClick={() => setEndpoint('https://api.aholo3d.cn')}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border:
                    endpoint === 'https://api.aholo3d.cn'
                      ? '1.5px solid #38bdf8'
                      : '1px solid var(--border)',
                  background:
                    endpoint === 'https://api.aholo3d.cn'
                      ? 'rgba(14, 165, 233, 0.12)'
                      : 'var(--surface-2)',
                  color: endpoint === 'https://api.aholo3d.cn' ? '#38bdf8' : 'var(--muted)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 12 }}>🌏 China Region</div>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>api.aholo3d.cn (/lux3d/v1)</div>
              </button>
            </div>
          </div>

          {/* Footer buttons */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              paddingTop: 8,
              borderTop: '1px solid var(--border)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--muted)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
            <button
              type="button"
              className="lux-action-btn"
              onClick={handleSave}
              style={{ width: 'auto', padding: '8px 18px', fontSize: 12 }}
            >
              {saved ? '✓ Saved!' : 'Save & Close'}
            </button>
          </div>
        </SmoothScrollArea>
      </div>
    </div>
  );
}
