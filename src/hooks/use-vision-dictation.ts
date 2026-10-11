import { useEffect, useRef, useState } from "react";
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult:
    | ((e: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
        resultIndex: number;
      }) => void)
    | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionConstructor = new () => Recognition;
export function useVisionDictation(onText: (text: string) => void) {
  const callback = useRef(onText);
  useEffect(() => {
    callback.current = onText;
  }, [onText]);
  const recognition = useRef<Recognition | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const speech = window as Window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  const available = !!(
    speech.SpeechRecognition || speech.webkitSpeechRecognition
  );
  useEffect(() => () => recognition.current?.abort(), []);
  const stop = () => recognition.current?.stop();
  const toggle = () => {
    if (listening) {
      stop();
      return;
    }
    const Ctor = speech.SpeechRecognition || speech.webkitSpeechRecognition;
    if (!Ctor) return;
    setError("");
    const r = new Ctor();
    recognition.current = r;
    r.continuous = true;
    r.interimResults = false;
    r.lang = navigator.language;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++)
        callback.current(e.results[i][0].transcript);
    };
    r.onerror = (e) => {
      setError(`Dictation unavailable: ${e.error}. You can continue typing.`);
      setListening(false);
    };
    r.onend = () => setListening(false);
    try {
      r.start();
      setListening(true);
    } catch (e) {
      setError(String(e));
    }
  };
  return { available, listening, error, toggle, stop };
}
