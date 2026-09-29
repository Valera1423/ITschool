// frontend/src/hooks/useVoiceInput.ts
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Голосовой ввод через Web Speech API.
 * Поддержка: Chrome, Edge, Safari (частично), Яндекс.Браузер.
 *
 * Firefox — не поддерживает без флага.
 * iOS Safari — поддерживает с 14.5.
 */

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string; confidence: number };
  }>;
}

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseVoiceInputOptions {
  lang?: string;
  /** Колбэк с финальным распознанным текстом (кумулятивно) */
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (msg: string) => void;
}

export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const { lang = 'ru-RU', onResult, onError } = options;

  const [supported] = useState(() => !!getCtor());
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const bufferRef = useRef('');

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      onError?.('Web Speech API не поддерживается этим браузером');
      return;
    }

    if (listening) return;

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    bufferRef.current = '';

    rec.onresult = (ev) => {
      let interim = '';
      let final = '';

      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        const text = res[0].transcript;
        if (res.isFinal) final += text;
        else interim += text;
      }

      if (final) bufferRef.current += final;
      const combined = bufferRef.current + interim;
      onResult?.(combined, !!final);
    };

    rec.onerror = (ev) => {
      if (ev.error === 'no-speech') return; // не считаем ошибкой
      if (ev.error === 'aborted') return;
      onError?.(`Ошибка распознавания: ${ev.error}`);
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
    };

    recognitionRef.current = rec;

    try {
      rec.start();
      setListening(true);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Не удалось запустить распознавание');
    }
  }, [lang, onResult, onError, listening]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return { supported, listening, start, stop, toggle };
}