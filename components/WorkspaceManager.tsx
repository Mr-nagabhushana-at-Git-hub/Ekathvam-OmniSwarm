"use client";

import React, { useState, useEffect } from "react";
import git from "isomorphic-git";
import http from "isomorphic-git/http/web";
import JSZip from "jszip";
import LightningFS from "@isomorphic-git/lightning-fs";

export default function WorkspaceManager() {
  const [repoUrl, setRepoUrl] = useState("");
  const [status, setStatus] = useState("Idle");
  const [fs, setFs] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Initialize Origin Private File System for client-side git storage
      const lfs = new LightningFS("omniswarm-fs");
      setFs(lfs);
    }
  }, []);

  const cloneRepo = async () => {
    if (!fs || !repoUrl) return;
    setStatus(`Cloning ${repoUrl}...`);
    try {
      const dir = "/workspace";
      await fs.promises.mkdir(dir, { recursive: true });
      
      await git.clone({
        fs,
        http,
        dir,
        corsProxy: 'https://cors.isomorphic-git.org',
        url: repoUrl,
        singleBranch: true,
        depth: 1
      });
      
      setStatus("Clone successful! Repository is loaded in browser memory.");
    } catch (err: any) {
      console.error(err);
      setStatus(`Clone failed: ${err.message}`);
    }
  };

  const packAndDownload = async () => {
    if (!fs) return;
    setStatus("Packing repository to ZIP...");
    try {
      const zip = new JSZip();
      const dir = "/workspace";
      
      // Recursive function to pack files
      const addFilesToZip = async (currentPath: string, currentZipFolder: JSZip) => {
        const entries = await fs.promises.readdir(currentPath);
        for (const entry of entries) {
          if (entry === '.git') continue; // skip git internals to save space
          
          const fullPath = `${currentPath}/${entry}`;
          const stat = await fs.promises.stat(fullPath);
          
          if (stat.isDirectory()) {
            const newFolder = currentZipFolder.folder(entry);
            if (newFolder) await addFilesToZip(fullPath, newFolder);
          } else {
            const content = await fs.promises.readFile(fullPath);
            currentZipFolder.file(entry, content);
          }
        }
      };

      await addFilesToZip(dir, zip);
      const blob = await zip.generateAsync({ type: "blob" });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "omniswarm-repo.zip";
      a.click();
      URL.revokeObjectURL(url);
      
      setStatus("Repository zipped and downloaded!");
    } catch (err: any) {
      console.error(err);
      setStatus(`Pack failed: ${err.message}`);
    }
  };

  const handleZipUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check 500MB limit
    if (file.size > 500 * 1024 * 1024) {
      setStatus("Error: File exceeds 500MB limit.");
      return;
    }
    
    setStatus(`Uploaded ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB). Ready for Agent processing.`);
    // In a full implementation, you would extract this zip using JSZip into the LightningFS here.
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 mt-4 shadow-xl">
      <h3 className="text-lg font-bold text-gray-100 mb-4">🖥️ Agentic Workspace (Local Memory)</h3>
      
      <div className="flex flex-col gap-4">
        {/* Repo Clone Section */}
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="https://github.com/username/repo" 
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button 
            onClick={cloneRepo}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded shadow transition-colors"
          >
            Clone Repo
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 items-center">
          <label className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold rounded shadow cursor-pointer transition-colors">
            📤 Upload ZIP (Max 500MB)
            <input type="file" accept=".zip" className="hidden" onChange={handleZipUpload} />
          </label>
          
          <button 
            onClick={packAndDownload}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded shadow transition-colors"
          >
            📥 Pack Workspace to ZIP
          </button>
        </div>

        {/* Status Console */}
        <div className="bg-black p-3 rounded font-mono text-xs text-green-400 h-16 overflow-y-auto">
          &gt; {status}
        </div>
      </div>
    </div>
  );
}
