"use client";

import React, { useState } from "react";
import JSZip from "jszip";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import pptxgen from "pptxgenjs";

interface ArtifactExporterProps {
  content: string;
  files?: Record<string, string>;
}

export default function ArtifactExporter({ content, files }: ArtifactExporterProps) {
  const [isExporting, setIsExporting] = useState(false);

  const exportPDF = async () => {
    setIsExporting(true);
    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();
      const { width, height } = page.getSize();
      const fontSize = 12;
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // Simple text wrapping (could be expanded for complex markdown)
      const lines = content.split('\n');
      let yOffset = height - 50;

      for (const line of lines) {
        if (yOffset < 50) {
          pdfDoc.addPage();
          yOffset = height - 50;
        }
        page.drawText(line, { x: 50, y: yOffset, size: fontSize, font, color: rgb(0, 0, 0) });
        yOffset -= 15;
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      downloadBlob(blob, "omniswarm_export.pdf");
    } catch (err) {
      console.error("PDF Export failed:", err);
    }
    setIsExporting(false);
  };

  const exportPPT = () => {
    setIsExporting(true);
    try {
      const pres = new pptxgen();
      const slide = pres.addSlide();
      slide.addText("OmniSwarm Output", { x: 1, y: 1, fontSize: 24, bold: true, color: "363636" });
      slide.addText(content.substring(0, 2000), { x: 1, y: 2, w: "80%", h: "60%", fontSize: 14, color: "666666" });
      pres.writeFile({ fileName: "omniswarm_presentation.pptx" });
    } catch (err) {
      console.error("PPT Export failed:", err);
    }
    setIsExporting(false);
  };

  const exportZIP = async () => {
    setIsExporting(true);
    try {
      const zip = new JSZip();
      zip.file("output.txt", content);
      
      if (files) {
        Object.entries(files).forEach(([filename, fileContent]) => {
          zip.file(filename, fileContent);
        });
      }

      const contentZip = await zip.generateAsync({ type: "blob" });
      downloadBlob(contentZip, "omniswarm_workspace.zip");
    } catch (err) {
      console.error("ZIP Export failed:", err);
    }
    setIsExporting(false);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex gap-2 p-4 bg-gray-900 rounded-lg border border-gray-700 shadow-xl mt-4">
      <div className="text-sm font-medium text-gray-300 self-center mr-4">Export Artifacts:</div>
      <button 
        onClick={exportPDF} 
        disabled={isExporting}
        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded shadow disabled:opacity-50 transition-colors"
      >
        📄 PDF
      </button>
      <button 
        onClick={exportPPT} 
        disabled={isExporting}
        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded shadow disabled:opacity-50 transition-colors"
      >
        📊 PPT
      </button>
      <button 
        onClick={exportZIP} 
        disabled={isExporting}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded shadow disabled:opacity-50 transition-colors"
      >
        📦 ZIP
      </button>
    </div>
  );
}
