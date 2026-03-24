/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { jsPDF } from "jspdf";
import { motion, AnimatePresence } from 'motion/react';

// Types
interface AnalysisResult {
  permitNumber: string;
  orderNumber: string;
  taskName: string;
  taskDate: string;
  workerCount: string;
}

interface PdfImage {
  dataUrl: string;
  mime: string;
}

export default function App() {
  // State
  const [analyzeImage, setAnalyzeImage] = useState<{ dataUrl: string; base64: string; mime: string } | null>(null);
  const [pdfImages, setPdfImages] = useState<PdfImage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Refs
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const analyzeInputRef = useRef<HTMLInputElement>(null);

  // URL 파라미터 처리 (단축어 연동용)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const permit = params.get('permit');
    const order = params.get('order');
    const task = params.get('task');
    const date = params.get('date');
    const people = params.get('people');

    if (permit || order || task || date || people) {
      setResult({
        permitNumber: permit || '',
        orderNumber: order || '',
        taskName: task || '',
        taskDate: date || '',
        workerCount: people || ''
      });
    }
  }, []);

  // Toast handler
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  // Image compression
  const compressImage = (file: File): Promise<{ dataUrl: string; base64: string; mime: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          if (Math.max(w, h) > 1280) {
            const r = 1280 / Math.max(w, h);
            w *= r; h *= r;
          }
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve({ dataUrl, base64: dataUrl.split(',')[1], mime: 'image/jpeg' });
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePdfSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const compressed = await Promise.all(files.map(compressImage));
    setPdfImages(prev => [...prev, ...compressed]);
    e.target.value = '';
  };

  const handleAnalyzeSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const compressed = await compressImage(file);
      setAnalyzeImage(compressed);
      setResult(null);
    }
    e.target.value = '';
  };

  const analyze = async () => {
    if (!analyzeImage) return;
    setIsAnalyzing(true);
    
    // ⚠️ 여기에 본인의 GAS 웹 앱 URL을 넣으세요
    const GAS_URL = "https://script.google.com/macros/s/AKfycbyxMbFpCd_5YUPS8ZkcxbLL-LMC_Wqk0sTwPUSY5FZMo9iF95z_FeZ1vRXXrEWuEC4O/exec";

    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ image: analyzeImage.base64, mime: analyzeImage.mime })
      });
      const data = await response.json();
      
      // Gemini 응답 구조에 맞게 파싱
      const text = data.candidates[0].content.parts[0].text;
      const parsed = JSON.parse(text);
      setResult(parsed);
      showToast('분석 완료 ✓');
    } catch (err) {
      showToast('분석 실패: GAS 설정을 확인하세요', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const makePdf = async () => {
    const doc = new jsPDF();
    for (let i = 0; i < pdfImages.length; i++) {
      if (i > 0) doc.addPage();
      doc.addImage(pdfImages[i].dataUrl, 'JPEG', 10, 10, 190, 277);
    }
    doc.save(`permit_${new Date().getTime()}.pdf`);
    showToast('PDF 저장 완료!');
  };

  const copyToClipboard = (text: string, field: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1200);
    });
  };

  const copyAll = () => {
    if (!result) return;
    const text = `허가번호 : ${result.permitNumber}\n오더번호 : ${result.orderNumber}\n작업명   : ${result.taskName}\n작업일   : ${result.taskDate}\n작업인원 : ${result.workerCount}`;
    navigator.clipboard.writeText(text).then(() => showToast('전체 복사 완료'));
  };

  return (
    <div className="min-h-screen bg-[#f0f4f8] p-4 font-sans text-[#1c1c1e]">
      <div className="max-w-md mx-auto">
        <div className="text-center text-[18px] font-bold text-[#1a5276] mb-4 p-3 bg-white rounded-xl shadow-[0_2px_6px_rgba(0,0,0,0.08)]">
          📋 작업허가서 분석 <span className="text-[13px] text-[#8e44ad] font-normal">iPhone v1.4</span>
        </div>

        {/* 단축어 배너 */}
        <a 
          href="https://www.icloud.com/shortcuts/4d78469de9d643b2804b9e1a5d947aff"
          className="flex items-center justify-between bg-gradient-to-br from-[#6c3483] to-[#8e44ad] rounded-xl p-3 px-4 mb-4 shadow-[0_3px_8px_rgba(142,68,173,0.3)] no-underline"
        >
          <div className="text-white">
            <div className="text-[14px] font-bold">📲 단축어 설치</div>
            <div className="text-[11px] opacity-85 mt-0.5">탭하면 단축어 앱으로 바로 설치됩니다</div>
          </div>
          <div className="bg-white text-[#6c3483] text-[13px] font-bold px-3.5 py-1.5 rounded-full">설치하기</div>
        </a>

        {/* 업로드 버튼 */}
        <div className="flex gap-2.5 mb-4">
          <button 
            onClick={() => pdfInputRef.current?.click()}
            className="flex-1 flex flex-col items-center justify-center p-3.5 bg-gradient-to-br from-[#8e44ad] to-[#6c3483] text-white rounded-xl font-bold shadow-[0_3px_8px_rgba(142,68,173,0.3)] active:opacity-75 transition-opacity"
          >
            <span className="text-[22px] mb-1">🖼️</span>
            <span className="text-[14px]">PDF용 사진가져오기</span>
          </button>
          <button 
            onClick={() => analyzeInputRef.current?.click()}
            className="flex-1 flex flex-col items-center justify-center p-3.5 bg-gradient-to-br from-[#e67e22] to-[#ca6f1e] text-white rounded-xl font-bold shadow-[0_3px_8px_rgba(230,126,34,0.35)] active:opacity-75 transition-opacity"
          >
            <span className="text-[22px] mb-1">🔍</span>
            <span className="text-[14px]">허가서 사진분석</span>
          </button>
        </div>

        <input type="file" ref={pdfInputRef} onChange={handlePdfSelect} accept="image/*" multiple className="hidden" />
        <input type="file" ref={analyzeInputRef} onChange={handleAnalyzeSelect} accept="image/*" className="hidden" />

        {/* PDF 섹션 */}
        {pdfImages.length > 0 && (
          <div className="mb-4">
            <div className="text-[12px] text-[#888] font-bold tracking-wider mb-2 pl-1">
              PDF 사진 목록 <span className="text-[#8e44ad]">{pdfImages.length}장</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {pdfImages.map((img, i) => (
                <div key={i} className="relative aspect-[3/4] rounded-lg overflow-hidden bg-[#ddd]">
                  <img src={img.dataUrl} className="w-full h-full object-cover" />
                  <button 
                    onClick={() => setPdfImages(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 bg-black/60 text-white w-[22px] h-[22px] rounded-full text-[13px] flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ))}
              <div onClick={() => pdfInputRef.current?.click()} className="aspect-[3/4] rounded-lg border-2 border-dashed border-[#8e44ad] bg-[#f8f0fd] text-[#8e44ad] text-[24px] flex items-center justify-center cursor-pointer">+</div>
            </div>
            <button onClick={makePdf} className="w-full p-3.5 bg-gradient-to-br from-[#8e44ad] to-[#6c3483] text-white rounded-xl text-[15px] font-bold shadow-[0_3px_8px_rgba(142,68,173,0.3)] active:opacity-80 transition-opacity">📄 PDF 생성하기</button>
          </div>
        )}

        {/* 분석 미리보기 및 실행 */}
        {analyzeImage && (
          <div className="mb-4">
            <div className="relative text-center mb-3">
              <img src={analyzeImage.dataUrl} className="max-w-full max-h-[180px] mx-auto rounded-xl shadow-md" />
              <button onClick={() => setAnalyzeImage(null)} className="absolute top-1.5 right-[calc(50%-80px)] bg-black/55 text-white w-[24px] h-[24px] rounded-full text-[13px] flex items-center justify-center">✕</button>
            </div>
            <button 
              onClick={analyze} 
              disabled={isAnalyzing}
              className="w-full p-3.5 bg-gradient-to-br from-[#27ae60] to-[#1e8449] text-white rounded-xl text-[16px] font-bold shadow-md active:opacity-80 disabled:opacity-70"
            >
              {isAnalyzing ? '🔍 분석 중...' : '🔍 사진 분석 시작'}
            </button>
          </div>
        )}

        {/* 결과 카드 */}
        <div className="text-[12px] text-[#888] font-bold tracking-wider mb-2 pl-1">분석 결과</div>
        <div className="bg-white rounded-xl shadow-[0_2px_6px_rgba(0,0,0,0.07)] overflow-hidden mb-2.5">
          {[
            { id: 'permit', label: '허가번호', value: result?.permitNumber },
            { id: 'order', label: '오더번호', value: result?.orderNumber },
            { id: 'task', label: '작업명', value: result?.taskName },
            { id: 'date', label: '작업일', value: result?.taskDate },
            { id: 'people', label: '작업인원', value: result?.workerCount },
          ].map((row, i) => (
            <div key={row.id} className={`flex items-center p-3.5 px-4 ${i !== 4 ? 'border-b border-[#f0f0f0]' : ''}`}>
              <span className="text-[12px] text-[#888] w-[72px] shrink-0">{row.label}</span>
              <span className={`flex-1 text-[15px] font-semibold break-all ${!row.value ? 'text-[#ccc] font-normal italic' : 'text-[#1c1c1e]'}`}>
                {row.value || '—'}
              </span>
              <button 
                onClick={() => copyToClipboard(row.value || '', row.id)}
                className={`ml-2 px-3 py-1.5 rounded-lg text-[13px] font-bold transition-all ${
                  copiedField === row.id ? 'bg-[#27ae60] text-white' : 'bg-[#e8f1fb] text-[#2e75b6] active:bg-[#2e75b6] active:text-white'
                }`}
              >
                {copiedField === row.id ? '✓' : '복사'}
              </button>
            </div>
          ))}
        </div>

        <button onClick={copyAll} className="w-full p-3.5 bg-gradient-to-br from-[#d35400] to-[#b94600] text-white rounded-xl text-[15px] font-bold shadow-[0_3px_8px_rgba(211,84,0,0.35)] active:opacity-80 transition-opacity mb-5">📋 전체 내용 복사</button>

        {/* 바로가기 */}
        <div className="flex justify-between items-center mb-2 px-1">
          <span className="text-[12px] text-[#888] font-bold tracking-wider">바로가기</span>
          <a href="https://juneylee.github.io/sc4Permit/" className="text-[12px] text-[#2e75b6] font-bold no-underline">일반 버전 1.4</a>
        </div>
        <div className="flex gap-2.5 mb-8">
          <a href="https://sahps.kr/safety/workpermitreg/" onClick={() => copyToClipboard(result?.taskName || '', 'task')} className="flex-1 text-center no-underline p-3.5 rounded-xl text-[13px] font-bold text-white shadow-[0_3px_8px_rgba(0,0,0,0.15)] bg-gradient-to-br from-[#1e8449] to-[#196f3d] active:opacity-75">
            <span className="text-[20px] block mb-1">🛡️</span>안전보건
          </a>
          <a href="kakaotalk://" onClick={() => copyToClipboard(result?.taskName || '', 'task')} className="flex-1 text-center no-underline p-3.5 rounded-xl text-[13px] font-bold text-[#3c1e1e] shadow-[0_3px_8px_rgba(0,0,0,0.15)] bg-gradient-to-br from-[#f9e000] to-[#e6c800] active:opacity-75">
            <span className="text-[20px] block mb-1">💬</span>카카오톡
          </a>
          <a href="bandapp://" onClick={() => copyToClipboard(result?.taskName || '', 'task')} className="flex-1 text-center no-underline p-3.5 rounded-xl text-[13px] font-bold text-white shadow-[0_3px_8px_rgba(0,0,0,0.15)] bg-gradient-to-br from-[#00c73c] to-[#009e30] active:opacity-75">
            <span className="text-[20px] block mb-1">📣</span>네이버밴드
          </a>
        </div>
      </div>

      {/* 토스트 */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className={`fixed bottom-20 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full text-[14px] text-white shadow-lg z-[999] whitespace-nowrap pointer-events-none ${
              toast.type === 'error' ? 'bg-[#c0392b]/90' : 'bg-black/75'
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
