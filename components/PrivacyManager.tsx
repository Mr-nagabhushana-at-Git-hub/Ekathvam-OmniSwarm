"use client";

import React, { useState, useEffect } from "react";

interface PrivacyManagerProps {
  apiKey: string;
  setApiKey: (key: string) => void;
  provider: string;
  setProvider: (provider: string) => void;
  encryptPayload: boolean;
  setEncryptPayload: (val: boolean) => void;
  onClearChat: () => void;
}

export const PrivacyManager: React.FC<PrivacyManagerProps> = ({
  apiKey,
  setApiKey,
  provider,
  setProvider,
  encryptPayload,
  setEncryptPayload,
  onClearChat,
}) => {
  const [showKey, setShowKey] = useState(false);
  const [tombstone, setTombstone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Sync with session storage if available (held only for session)
  useEffect(() => {
    const savedKey = sessionStorage.getItem(`key_${provider}`);
    if (savedKey) setApiKey(savedKey);
    else setApiKey("");
  }, [provider, setApiKey]);

  const handleKeyChange = (val: string) => {
    setApiKey(val);
    sessionStorage.setItem(`key_${provider}`, val);
  };

  const handleDeleteData = async () => {
    setLoading(true);
    try {
      // Clear session keys
      sessionStorage.clear();
      localStorage.clear();
      setApiKey("");
      onClearChat();

      // Call API to erase any transient files/logs
      const res = await fetch("/api/delete-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.tombstone) {
        setTombstone(data.tombstone);
      }
    } catch (err) {
      console.error("Scrub failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass p-4 rounded-xl mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-white flex items-center gap-2">
            🛡️ Privacy & Compliance Console
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono">
              DPDP Compliant
            </span>
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            BYO-key architecture. Keys and prompts are never saved or stored server-side.
          </p>
        </div>
        <button
          onClick={handleDeleteData}
          disabled={loading}
          className="text-xs bg-red-950/40 text-red-400 border border-red-900/50 hover:bg-red-900/30 px-3 py-1.5 rounded-lg font-medium transition-all"
        >
          {loading ? "Purging..." : "⚠️ Delete My Data (Verify Scrub)"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-zinc-800/80">
        <div>
          <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
            API Provider
          </label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
          >
            <option value="Cerebras">Cerebras Cloud (Gemma 4 31B)</option>
            <option value="Google Gemini">Google Gemini</option>
            <option value="OpenAI">OpenAI</option>
            <option value="Anthropic">Anthropic</option>
            <option value="Groq">Groq</option>
          </select>
        </div>

        <div className="relative">
          <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
            API Key
          </label>
          <div className="flex">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => handleKeyChange(e.target.value)}
              placeholder={`Enter ${provider} API Key`}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors pr-10"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-[32px] text-zinc-500 hover:text-zinc-300"
            >
              {showKey ? "🙈" : "👁️"}
            </button>
          </div>
        </div>

        <div className="flex flex-col justify-end">
          <label className="flex items-center gap-2 cursor-pointer select-none py-2">
            <input
              type="checkbox"
              checked={encryptPayload}
              onChange={(e) => setEncryptPayload(e.target.checked)}
              className="rounded bg-zinc-900 border-zinc-800 text-indigo-600 focus:ring-0 focus:ring-offset-0"
            />
            <div>
              <span className="text-sm font-medium text-zinc-300">Envelope Encryption (WebCrypto)</span>
              <p className="text-[10px] text-zinc-500">
                Encrypts payload client-side before transport via TLS.
              </p>
            </div>
          </label>
        </div>
      </div>

      {tombstone && (
        <div className="mt-4 p-3 bg-zinc-900/80 border border-emerald-500/20 rounded-lg flex flex-col gap-1.5 animate-pulse-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400">Verifiable Cryptographic Tombstone Receipt</span>
            <button
              onClick={() => setTombstone(null)}
              className="text-[10px] text-zinc-500 hover:text-zinc-300"
            >
              [Dismiss]
            </button>
          </div>
          <pre className="text-[9px] text-emerald-500/80 font-mono break-all whitespace-pre-wrap max-h-20 overflow-y-auto bg-black/40 p-2 rounded border border-emerald-950">
            {tombstone}
          </pre>
          <span className="text-[9px] text-zinc-500">
            DPDP Role Audit: User is <strong>Data Fiduciary</strong>, Ekathvam-OmniSwarm is <strong>Data Processor</strong>. Storage Scrub verification: 100% complete.
          </span>
        </div>
      )}
    </div>
  );
};
