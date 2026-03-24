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
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Refs
  const analyzeInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

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
  const compressImage = (file: File, maxPx: number = 1280, quality: number = 0.82): Promise<{ dataUrl: string; base64: string; mime: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width;
          let h = img.height;
          if (Math.max(w, h) > maxPx) {
            const r = maxPx / Math.max(w, h);
            w = Math.round(w * r);
            h = Math.round(h * r);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas context failed'));
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          const base64 = dataUrl.split(',')[1];
          resolve({ dataUrl, base64, mime: 'image/jpeg' });
        };
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = ev.target?.result as string;
      };
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  };

  // Handlers
  const handleAnalyzeFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const compressed = await compressImage(file);
      setAnalyzeImage(compressed);
      setError(null);
      setResult(null);
    } catch (err) {
      showToast('이미지 처리 중 오류가 발생했습니다.', 'error');
    }
    e.target.value = '';
  };

  const handlePdfFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    try {
      const compressedFiles = await Promise.all(files.map(file => compressImage(file)));
      setPdfImages(prev => [...prev, ...compressedFiles.map(c => ({ dataUrl: c.dataUrl, mime: c.mime }))]);
    } catch (err) {
      showToast('이미지 처리 중 오류가 발생했습니다.', 'error');
    }
    e.target.value = '';
  };

  const removePdfImage = (index: number) => {
    setPdfImages(prev => prev.filter((_, i) => i !== index));
  };

  const analyze = async () => {
    if (!analyzeImage) return;
    
    setIsAnalyzing(true);
    setError(null);

    // 여기에 본인의 GAS 웹 앱 URL을 넣으세요
    const GAS_URL = "여기에_복사한_GAS_웹_앱_URL_입력";

    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          image: analyzeImage.base64,
          mime: analyzeImage.mime
        })
      });

      if (!response.ok) {
        throw new Error('GAS 서버 응답 오류');
      }

      const data = await response.json();
      setResult(data);
      showToast('분석 완료 ✓');
    } catch (err: any) {
      console.error(err);
      setError('분석 오류가 발생했습니다. GAS 배포 설정을 확인하세요.\n' + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const makePdf = async () => {
    if (!pdfImages.length) {
      showToast('사진을 먼저 선택하세요', 'error');
      return;
    }

    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W = 210, H = 297;

      for (let i = 0; i < pdfImages.length; i++) {
        if (i > 0) doc.addPage();
        
        const imgEl = new Image();
        await new Promise((resolve) => {
          imgEl.onload = resolve;
          imgEl.src = pdfImages[i].dataUrl;
        });

        const ratio = Math.min(W / imgEl.width, H / imgEl.height);
        const w = imgEl.width * ratio;
        const h = imgEl.height * ratio;
        
        doc.addImage(
          pdfImages[i].dataUrl,
          pdfImages[i].mime === 'image/png' ? 'PNG' : 'JPEG',
          (W - w) / 2,
          (H - h) / 2,
          w,
          h
        );
      }

      const now = new Date();
      const dateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
      doc.save(`permit_${dateStr}.pdf`);
      showToast('PDF 저장 완료!');
    } catch (err: any) {
      showToast('PDF 생성 오류: ' + err.message, 'error');
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    if (!text || text === '—') return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1200);
    });
  };

  const copyAll = () => {
    if (!result) return;
    const fields = [
      { label: '허가번호', value: result.permitNumber },
      { label: '오더번호', value: result.orderNumber },
      { label: '작업명  ', value: result.taskName },
      { label: '작업일  ', value: result.taskDate },
      { label: '작업인원', value: result.workerCount },
    ];
    const filled = fields.filter(f => f.value && f.value !== '—');
    if (!filled.length) { showToast('분석 결과가 없습니다', 'error'); return; }
    const lines = filled.map(f => `${f.label} : ${f.value}`).join('\n');
    navigator.clipboard.writeText(lines).then(() => showToast('전체 복사 완료'));
  };

  return (
    <div className="min-h-screen bg-[#f0f4f8] p-4 font-sans text-[#1c1c1e]">
      <div className="max-w-md mx-auto">
        <div className="text-center text-[18px] font-bold text-[#1a5276] mb-4 p-3 bg-white rounded-xl shadow-[0_2px_6px_rgba(0,0,0,0.08)]">
          📋 작업허가서 분석
        </div>

        {/* API 오류 박스 */}
        {error && (
          <div className="bg-[#fdf0ee] border border-[#e74c3c] rounded-xl p-3 mb-4 text-[13px] color-[#c0392b] leading-relaxed whitespace-pre-wrap">
            {error}
          </div>
        )}

        {/* 파일 input */}
        <input type="file" ref={pdfInputRef} onChange={handlePdfFileSelect} accept="image/*" multiple className="hidden" />
        <input type="file" ref={analyzeInputRef} onChange={handleAnalyzeFileSelect} accept="image/*" className="hidden" />

        {/* 버튼 영역 */}
        <div className="flex gap-2.5 mb-4">
          <button 
            onClick={() => pdfInputRef.current?.click()}
            className="flex-1 flex flex-col items-center justify-center p-4 rounded-xl text-[14px] font-bold text-white gap-1.5 active:opacity-75 transition-opacity bg-gradient-to-br from-[#8e44ad] to-[#6c3483] shadow-[0_3px_8px_rgba(142,68,173,0.3)]"
          >
            <span className="text-[22px]">🖼️</span>PDF용 사진가져오기
          </button>
          <button 
            onClick={() => analyzeInputRef.current?.click()}
            className="flex-1 flex flex-col items-center justify-center p-4 rounded-xl text-[14px] font-bold text-white gap-1.5 active:opacity-75 transition-opacity bg-gradient-to-br from-[#2e75b6] to-[#1a5276] shadow-[0_3px_8px_rgba(46,117,182,0.3)]"
          >
            <span className="text-[22px]">🖼️</span>허가서 사진가져오기
          </button>
        </div>

        {/* PDF 섹션 */}
        {pdfImages.length > 0 && (
          <div className="mb-4">
            <div className="text-[12px] text-[#888] font-bold tracking-wider mb-2 pl-1">
              PDF 사진 목록 <span className="text-[#8e44ad]">{pdfImages.length}장</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {pdfImages.map((img, i) => (
                <div key={i} className="relative aspect-[3/4] rounded-lg overflow-hidden bg-[#ddd]">
                  <img src={img.dataUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <button 
                    onClick={() => removePdfImage(i)}
                    className="absolute top-1 right-1 bg-black/60 text-white w-[22px] h-[22px] rounded-full text-[13px] flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ))}
              <div 
                onClick={() => pdfInputRef.current?.click()}
                className="aspect-[3/4] rounded-lg border-2 border-dashed border-[#8e44ad] bg-[#f8f0fd] text-[#8e44ad] text-[24px] flex items-center justify-center cursor-pointer"
              >
                +
              </div>
            </div>
            <button 
              onClick={makePdf}
              className="w-full p-3.5 bg-gradient-to-br from-[#8e44ad] to-[#6c3483] text-white rounded-xl text-[15px] font-bold shadow-[0_3px_8px_rgba(142,68,173,0.3)] active:opacity-80 transition-opacity"
            >
              📄 PDF 생성하기
            </button>
          </div>
        )}

        {/* 허가서 분석 미리보기 */}
        {analyzeImage && (
          <div className="mb-4">
            <div className="relative text-center mb-3">
              <img src={analyzeImage.dataUrl} className="max-w-full max-h-[200px] mx-auto rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.15)]" referrerPolicy="no-referrer" />
              <button 
                onClick={() => setAnalyzeImage(null)}
                className="absolute top-1.5 right-[calc(50%-90px)] bg-black/55 text-white w-[26px] h-[26px] rounded-full text-[14px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <div className="flex gap-2">
              {!result ? (
                <button 
                  onClick={analyze}
                  disabled={isAnalyzing}
                  className="flex-1 p-3.5 bg-gradient-to-br from-[#27ae60] to-[#1e8449] text-white rounded-xl text-[16px] font-bold shadow-[0_3px_8px_rgba(39,174,96,0.3)] active:opacity-80 transition-opacity disabled:opacity-70"
                >
                  {isAnalyzing ? '🔍 분석 중...' : '🔍 분석하기'}
                </button>
              ) : (
                <button 
                  onClick={analyze}
                  disabled={isAnalyzing}
                  className="flex-1 p-3.5 bg-[#eaf4f0] text-[#1e8449] rounded-xl text-[14px] font-bold active:bg-[#27ae60] active:text-white transition-all"
                >
                  ↺ 재분석
                </button>
              )}
            </div>
          </div>
        )}

        {isAnalyzing && (
          <div className="text-center p-5 text-[#2e75b6] text-[15px] font-bold">
            <div className="w-9 h-9 border-4 border-[#e0e0e0] border-t-[#2e75b6] rounded-full animate-spin mx-auto mb-2.5"></div>
            분석 중입니다...
          </div>
        )}

        {/* 분석 결과 */}
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
                  copiedField === row.id 
                    ? 'bg-[#27ae60] text-white' 
                    : 'bg-[#e8f1fb] text-[#2e75b6] active:bg-[#2e75b6] active:text-white'
                }`}
              >
                {copiedField === row.id ? '✓' : '복사'}
              </button>
            </div>
          ))}
        </div>

        <button 
          onClick={copyAll}
          className="w-full p-3.5 bg-[#1a5276] text-white rounded-xl text-[15px] font-bold shadow-[0_3px_8px_rgba(26,82,118,0.3)] active:opacity-80 transition-opacity mb-5"
        >
          📋 전체 내용 복사
        </button>

        <div className="flex justify-between items-center mb-2 px-1">
          <span className="text-[12px] text-[#888] font-bold tracking-wider">바로가기</span>
          <a href="https://juneylee.github.io/sc4Permit/4SC.html" className="text-[12px] text-[#2e75b6] font-bold no-underline">아이폰 단축어용</a>
        </div>
        <div className="flex gap-2.5 mb-4">
          <a 
            href="https://sahps.kr/safety/workpermitreg/" 
            onClick={() => copyToClipboard(result?.taskName || '', 'task')}
            className="flex-1 text-center no-underline p-3.5 rounded-xl text-[13px] font-bold text-white shadow-[0_3px_8px_rgba(0,0,0,0.15)] active:opacity-75 transition-opacity bg-gradient-to-br from-[#1e8449] to-[#196f3d]"
          >
            <span className="text-[20px] block mb-1">🛡️</span>안전보건
          </a>
          <a 
            href="kakaotalk://" 
            onClick={() => copyToClipboard(result?.taskName || '', 'task')}
            className="flex-1 text-center no-underline p-3.5 rounded-xl text-[13px] font-bold text-[#3c1e1e] shadow-[0_3px_8px_rgba(0,0,0,0.15)] active:opacity-75 transition-opacity bg-gradient-to-br from-[#f9e000] to-[#e6c800]"
          >
            <span className="text-[20px] block mb-1">💬</span>카카오톡
          </a>
          <a 
            href="bandapp://" 
            onClick={() => copyToClipboard(result?.taskName || '', 'task')}
            className="flex-1 text-center no-underline p-3.5 rounded-xl text-[13px] font-bold text-white shadow-[0_3px_8px_rgba(0,0,0,0.15)] active:opacity-75 transition-opacity bg-gradient-to-br from-[#00c73c] to-[#009e30]"
          >
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
