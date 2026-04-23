/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Plus, 
  Trash2, 
  Play, 
  Square, 
  Camera, 
  Image as ImageIcon, 
  ChevronRight, 
  Volume2, 
  CheckCircle2,
  Mic,
  Loader2,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini API
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Types
interface WordItem {
  id: string;
  text: string;
}

export default function App() {
  const [words, setWords] = useState<WordItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [isDictating, setIsDictating] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const last = event.results.length - 1;
        const text = event.results[last][0].transcript.trim();
        if (text.includes('下一个') || text.includes('下一個')) {
          handleNext();
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'no-speech' && isDictating) {
          try { recognition.start(); } catch(e) {}
        }
      };

      recognitionRef.current = recognition;
    }
  }, [isDictating]);

  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  };

  const handleNext = useCallback(() => {
    setCurrentIndex(prev => {
      const next = prev + 1;
      if (next < words.length) {
        speak(words[next].text);
        setStatusMessage(`正在听写：${words[next].text}`);
        return next;
      } else {
        finishDictation();
        return prev;
      }
    });
  }, [words]);

  const startDictation = () => {
    if (words.length === 0) return;
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    setWords(shuffled);
    setIsDictating(true);
    setCurrentIndex(0);
    speak(shuffled[0].text);
    setStatusMessage(`正在听写：${shuffled[0].text}`);
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error("Failed to start recognition", e);
      }
    }
  };

  const finishDictation = () => {
    speak('听写结束，宝贝辛苦了！');
    setStatusMessage('听写结束！');
    setIsDictating(false);
    setCurrentIndex(-1);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
      setIsListening(false);
    }
  };

  const stopDictation = () => {
    window.speechSynthesis.cancel();
    setIsDictating(false);
    setCurrentIndex(-1);
    setStatusMessage('');
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
      setIsListening(false);
    }
  };

  const addWordsManually = () => {
    if (!inputText.trim()) return;
    const newWords = inputText
      .split(/[\s\n，,]+/)
      .filter(w => w.trim())
      .map(w => ({ id: Math.random().toString(36).substr(2, 9), text: w }));
    setWords(prev => [...prev, ...newWords]);
    setInputText('');
  };

  const removeWord = (id: string) => {
    setWords(prev => prev.filter(w => w.id !== id));
  };

  const clearAll = () => {
    if (confirm('确定要清空所有字词吗？')) {
      setWords([]);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      await processImageWithGemini(base64.split(',')[1], file.type);
    };
    reader.readAsDataURL(file);
  };

  const processImageWithGemini = async (base64Data: string, mimeType: string) => {
    setIsProcessingImage(true);
    try {
      const prompt = `提取图片中的所有汉字。1. 如果提取到的是单个汉字，请为每个字生成一个常用的2-4字词组。2. 如果提取到的是现成的词组，则直接保留。3. 请只返回汉字列表。输出格式：JSON数组，例如 ["词语1", "词语2"]`;
      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts: [{ inlineData: { data: base64Data, mimeType } }, { text: prompt }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
      });
      const result = JSON.parse(response.text || "[]");
      if (Array.isArray(result)) {
        const newWords = result.map(w => ({ id: Math.random().toString(36).substr(2, 9), text: w }));
        setWords(prev => [...prev, ...newWords]);
      }
    } catch (error) {
      console.error("Gemini OCR failed", error);
      alert("识别失败，请重试");
    } finally {
      setIsProcessingImage(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-soft flex flex-col text-text-main overflow-hidden">
      {/* Geometric Header */}
      <header className="h-[80px] bg-card-white border-b-4 border-primary-light flex items-center px-6 md:px-10 justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-[44px] h-[44px] bg-primary-honey rounded-xl flex items-center justify-center text-white text-2xl font-bold border-3 border-text-main shadow-[4px_4px_0px_rgba(74,55,40,0.1)]">
            蜜
          </div>
          <div>
            <div className="text-xl font-black leading-tight">小蜜蜂听写助手</div>
            <div className="text-[10px] md:text-[12px] text-text-muted">智能语音 · 自动词组 · OCR识别</div>
          </div>
        </div>
        <div className="flex gap-3">
          {!isDictating && words.length > 0 && (
            <button 
              onClick={startDictation}
              className="hidden md:flex bg-primary-honey text-white px-5 py-2 rounded-xl font-bold border-2 border-text-main shadow-[0_4px_0_#D4881D] active:translate-y-1 active:shadow-none transition-all items-center gap-2"
            >
              <Play className="fill-current w-4 h-4" /> 开始听写
            </button>
          )}
          <button 
            onClick={() => window.location.reload()}
            className="bg-white px-5 py-2 rounded-xl font-bold border-2 border-text-main hover:bg-slate-50 transition-colors hidden sm:block"
          >
            重置应用
          </button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 p-6 overflow-hidden">
        {/* Left Panel: Management */}
        <div className="bg-card-white border-3 border-text-main rounded-[32px] shadow-neo flex flex-col overflow-hidden">
          <div className="p-5 px-6 border-b-2 border-dashed border-primary-light flex items-center justify-between shrink-0">
            <span className="font-extrabold text-[18px]">📖 字词库管理</span>
            <span className="text-xs font-bold text-secondary-mint bg-green-50 px-2 py-1 rounded-full">已收录 {words.length} 个</span>
          </div>
          
          <div className="flex-1 p-5 flex flex-col gap-4 overflow-hidden">
            {!isDictating ? (
              <div className="flex flex-col gap-4 h-full overflow-hidden">
                <div className="shrink-0 flex flex-col gap-4">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-text-muted rounded-2xl h-[100px] flex flex-col items-center justify-center bg-slate-50 cursor-pointer hover:border-primary-honey hover:bg-orange-50 transition-all text-text-muted group"
                  >
                    {isProcessingImage ? (
                      <Loader2 className="animate-spin w-6 h-6 text-primary-honey" />
                    ) : (
                      <>
                        <strong className="text-sm group-hover:text-primary-honey transition-colors">📸 点击上传课本照片</strong>
                        <span className="text-[10px]">OCR 自动提取生字并生成词组</span>
                      </>
                    )}
                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                  </div>

                  <textarea 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="在此输入字词，每行一个或空格分隔..."
                    className="w-full h-24 border-2 border-primary-light rounded-2xl p-4 text-[16px] resize-none bg-[#FFFBF5] outline-none focus:border-primary-honey transition-all"
                  />

                  <div className="flex gap-3">
                    <button 
                      onClick={addWordsManually}
                      className="flex-1 bg-secondary-mint text-white font-bold py-3 rounded-2xl border-2 border-text-main shadow-[0_4px_0_#5EAF5E] active:translate-y-1 active:shadow-none transition-all"
                    >
                      整理并存入
                    </button>
                    <button 
                      onClick={clearAll}
                      className="px-4 bg-white border-2 border-text-main text-red-400 rounded-2xl hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Word Preview List */}
                <div className="flex-1 overflow-hidden flex flex-col gap-2">
                  <div className="text-xs font-bold text-text-muted px-1 flex justify-between items-center">
                    <span>已添加词库预览</span>
                    <button onClick={clearAll} className="text-red-400 hover:underline">全部清空</button>
                  </div>
                  <div className="flex-1 overflow-y-auto pr-2 flex flex-wrap gap-2 content-start">
                    {words.length === 0 ? (
                      <div className="w-full h-full flex items-center justify-center text-text-muted/30 italic text-sm">
                        词库目前是空的喔~
                      </div>
                    ) : (
                      words.map((word) => (
                        <div 
                          key={word.id}
                          className="bg-primary-honey/10 text-text-main px-3 py-1.5 rounded-xl border border-primary-light flex items-center gap-2 group hover:bg-primary-honey/20 transition-all"
                        >
                          <span className="text-sm font-bold">{word.text}</span>
                          <button 
                            onClick={() => removeWord(word.id)}
                            className="text-text-muted hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2 overflow-y-auto pr-2">
                {words.map((word, idx) => (
                  <div 
                    key={word.id}
                    className={`p-3 rounded-xl border-2 transition-all flex justify-between items-center ${idx === currentIndex ? 'bg-primary-honey border-text-main text-white shadow-[4px_4px_0px_rgba(74,55,40,0.1)]' : 'bg-slate-50 border-transparent text-text-muted'}`}
                  >
                    <span className="font-bold">{word.text}</span>
                    {idx === currentIndex && <Volume2 className="w-4 h-4 animate-bounce" />}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="p-3 px-6 text-[14px] text-text-muted bg-[#F7F3E9] text-center border-t-2 border-primary-light shrink-0">
            支持自动转换：输入“过”自动生成“过去”
          </div>
        </div>

        {/* Right Panel: Exercise Area */}
        <div className="bg-card-white border-3 border-text-main rounded-[32px] shadow-neo flex flex-col overflow-hidden relative">
          <div className="p-5 px-6 border-b-2 border-dashed border-primary-light flex items-center justify-between shrink-0">
            <span className="font-extrabold text-[18px]">🎧 听写练习场</span>
            <div className="flex items-center gap-3 text-[14px]">
              <span className="text-text-muted">随机模式</span>
              <div className="w-[32px] h-[18px] bg-secondary-mint rounded-full relative border border-text-main/20">
                <div className="w-[12px] h-[12px] bg-white rounded-full absolute right-1 top-0.5 shadow-sm" />
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[radial-gradient(circle,_#FFFFFF_0%,_#FFF9E6_100%)]">
            {!isDictating ? (
              <div className="flex flex-col items-center gap-8 text-center max-w-sm">
                <div className="w-48 h-48 bg-bg-soft rounded-full flex items-center justify-center border-4 border-dashed border-primary-light">
                  <Play className="w-20 h-20 text-primary-light opacity-50" />
                </div>
                <div>
                  <h2 className="text-2xl font-black mb-2">准备好了吗？</h2>
                  <p className="text-text-muted">准备好笔和纸，点击下方按钮开始今天的听写练习吧！</p>
                </div>
                <button 
                  onClick={startDictation}
                  disabled={words.length === 0}
                  className="w-full bg-primary-honey text-white text-xl font-black py-5 rounded-[2rem] border-2 border-text-main shadow-[0_6px_0_#D4881D] active:translate-y-1.5 active:shadow-none disabled:opacity-50 disabled:active:translate-y-0 disabled:shadow-[0_6px_0_#D4881D] transition-all flex items-center justify-center gap-3"
                >
                  <Play className="fill-current w-6 h-6" /> 开始听写
                </button>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center">
                <div className="absolute top-8 font-black text-primary-honey bg-white/80 px-4 py-1 rounded-full border border-primary-light">
                  第 {currentIndex + 1} / {words.length} 个
                </div>

                <div className="text-[90px] md:text-[120px] font-black text-primary-honey mb-10 drop-shadow-[4px_4px_0px_#4A3728] tracking-[8px]">
                  {words[currentIndex]?.text || "🎉"}
                </div>

                <div className="w-full max-w-md h-[20px] bg-slate-100 rounded-full border-2 border-text-main overflow-hidden mb-6">
                  <div 
                    className="h-full bg-secondary-mint transition-all duration-500" 
                    style={{ width: `${((currentIndex + 1) / words.length) * 100}%` }}
                  />
                </div>

                <div className="flex items-center gap-3 text-[16px] text-text-muted mb-10">
                  <div className="w-3 h-3 bg-secondary-mint rounded-full animate-pulse-fast" />
                  <span>{statusMessage || '正在倾听... 请在听到报词后说“下一个”'}</span>
                </div>

                <div className="flex flex-wrap gap-4 justify-center">
                  <button 
                    onClick={() => speak(words[currentIndex].text)}
                    className="bg-white px-8 py-4 rounded-2xl font-bold border-2 border-text-main hover:bg-slate-50 transition-all flex items-center gap-2 active:translate-y-1"
                  >
                    🔊 重播一次
                  </button>
                  <button 
                    onClick={handleNext}
                    className="bg-secondary-mint text-white px-10 py-4 rounded-2xl font-black border-2 border-text-main shadow-[0_4px_0_#5EAF5E] active:translate-y-1 active:shadow-none transition-all flex items-center gap-2"
                  >
                    下一个 (Skip)
                  </button>
                  <button 
                    onClick={stopDictation}
                    className="bg-slate-100 text-text-muted px-8 py-4 rounded-2xl font-bold border-2 border-transparent hover:border-text-main transition-all"
                  >
                    结束
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <div className="p-3 px-6 text-[14px] text-text-muted bg-[#F7F3E9] text-center border-t-2 border-primary-light shrink-0">
            ✨ 当全部报完时，我会说“听写结束”哦！
          </div>
        </div>
      </main>
    </div>
  );
}
