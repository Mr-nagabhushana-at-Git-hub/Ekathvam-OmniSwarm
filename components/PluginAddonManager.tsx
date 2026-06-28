"use client";

import React, { useState } from "react";

interface PluginSchema {
  name: string;
  description: string;
  version: string;
  tools: any[];
}

export default function PluginAddonManager() {
  const [plugins, setPlugins] = useState<PluginSchema[]>([]);
  const [jsonInput, setJsonInput] = useState("");
  const [error, setError] = useState("");

  const handleInstallPlugin = () => {
    try {
      const parsed = JSON.parse(jsonInput) as PluginSchema;
      if (!parsed.name || !parsed.tools) {
        throw new Error("Invalid plugin format. Missing 'name' or 'tools'.");
      }
      
      setPlugins([...plugins, parsed]);
      setJsonInput("");
      setError("");
      
      // In a full implementation, this would dispatch the tools to the Swarm backend
      console.log("Installed Plugin:", parsed);
      
    } catch (err: any) {
      setError(err.message);
    }
  };

  const removePlugin = (index: number) => {
    const newPlugins = [...plugins];
    newPlugins.splice(index, 1);
    setPlugins(newPlugins);
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 mt-4 shadow-xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-100">🔌 Agent Plugins & Addons</h3>
        <span className="text-xs text-gray-400">Hermes & OpenAI Schema Support</span>
      </div>
      
      <div className="flex gap-4">
        <div className="flex-1">
          <textarea 
            className="w-full h-32 bg-gray-800 border border-gray-600 rounded p-3 text-sm text-gray-300 font-mono focus:outline-none focus:border-purple-500 transition-colors"
            placeholder={`{\n  "name": "hermes-search",\n  "description": "Custom search plugin",\n  "version": "1.0",\n  "tools": []\n}`}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
          />
          {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
          <button 
            onClick={handleInstallPlugin}
            className="mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded shadow transition-colors w-full"
          >
            + Install Addon
          </button>
        </div>

        <div className="flex-1 bg-black rounded p-3 overflow-y-auto max-h-44 border border-gray-800">
          <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Installed Addons</h4>
          {plugins.length === 0 ? (
            <p className="text-sm text-gray-600 italic">No plugins installed.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {plugins.map((plugin, idx) => (
                <div key={idx} className="flex justify-between items-center bg-gray-800 p-2 rounded border border-gray-700">
                  <div>
                    <div className="text-sm font-bold text-purple-400">{plugin.name}</div>
                    <div className="text-xs text-gray-400">{plugin.tools.length} tools loaded (v{plugin.version})</div>
                  </div>
                  <button 
                    onClick={() => removePlugin(idx)}
                    className="text-red-500 hover:text-red-400 text-xs font-bold px-2 py-1"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
