'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface TypingEngineProps {
    content: string;
    durationSeconds: number;
    targetWpm?: number;
    onComplete: (stats: { wpm: number; accuracy: number; mistakes: number }) => void;
}

export default function TypingEngine({ content, durationSeconds, targetWpm, onComplete }: TypingEngineProps) {
    const [timeLeft, setTimeLeft] = useState(durationSeconds);
    const [isActive, setIsActive] = useState(false);
    const [userInput, setUserInput] = useState('');
    const [wpm, setWpm] = useState(0);
    const [accuracy, setAccuracy] = useState(100);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const totalDuration = useRef(durationSeconds);

    // Split content into words/chars for display could be optimized, 
    // but simple string comparison works for MVP.

    const calculateStats = useCallback(() => {
        const timeElapsed = totalDuration.current - timeLeft;
        if (timeElapsed === 0) return;

        const wordsTyped = userInput.trim().split(/\s+/).length;
        const minutes = timeElapsed / 60;
        const currentWpm = Math.round(wordsTyped / minutes) || 0;

        // specific accuracy calculation (Levenshtein or simple char match)
        // Simple char match for now:
        let correctChars = 0;
        for (let i = 0; i < userInput.length; i++) {
            if (userInput[i] === content[i]) correctChars++;
        }
        const accuracyVal = userInput.length > 0 ? Math.round((correctChars / userInput.length) * 100) : 100;

        setWpm(currentWpm);
        setAccuracy(accuracyVal);
    }, [userInput, timeLeft, content]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        setIsActive(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else if (timeLeft === 0 && isActive) {
            setIsActive(false);
            calculateStats();
            onComplete({
                wpm,
                accuracy,
                mistakes: userInput.length - (userInput.length * (accuracy / 100)) // rough estimate
            });
        }
        return () => clearInterval(interval);
    }, [isActive, timeLeft, onComplete, wpm, accuracy, calculateStats, userInput.length]);

    useEffect(() => {
        calculateStats();
    }, [userInput, calculateStats]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        if (!isActive && timeLeft > 0) setIsActive(true);
        setUserInput(val);
    };

    // Prevent paste
    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
    };

    // Focus input on load
    useEffect(() => {
        if (inputRef.current) inputRef.current.focus();
    }, []);

    // Calculate progress for highlighting
    const getHighlightedText = () => {
        // This is a naive implementation. For large texts optimizing is needed.
        // Ideally, we render character by character.
        return content.split('').map((char, index) => {
            let color = 'text-zinc-400';
            if (index < userInput.length) {
                color = userInput[index] === char ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-100';
            } else if (index === userInput.length) {
                color = 'bg-blue-200 text-zinc-900 border-b-2 border-blue-500'; // cursor
            }
            return <span key={index} className={color}>{char}</span>;
        });
    };

    return (
        <div className="w-full max-w-5xl mx-auto space-y-6">
            {/* Stats Bar */}
            <div className="grid grid-cols-4 gap-4 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div className="text-center">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide">Time Left</p>
                    <p className={`text-3xl font-mono font-bold ${timeLeft < 30 ? 'text-red-600' : 'text-zinc-900 dark:text-zinc-100'}`}>
                        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide">WPM</p>
                    <p className="text-3xl font-mono font-bold text-blue-600">{wpm}</p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide">Accuracy</p>
                    <p className={`text-3xl font-mono font-bold ${accuracy < 90 ? 'text-orange-500' : 'text-green-600'}`}>
                        {accuracy}%
                    </p>
                </div>
                {targetWpm && (
                    <div className="text-center border-l border-zinc-200 dark:border-zinc-700">
                        <p className="text-xs text-zinc-500 uppercase tracking-wide">Target</p>
                        <p className="text-xl font-bold text-zinc-400 mt-1">{targetWpm} WPM</p>
                    </div>
                )}
            </div>

            {/* Text Display - Non-editable */}
            <div
                className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg font-mono text-lg leading-relaxed select-none h-64 overflow-y-auto"
                onClick={() => inputRef.current?.focus()}
            >
                {getHighlightedText()}
            </div>

            {/* Hidden/Transparent Input to capture keystrokes */}
            <textarea
                ref={inputRef}
                value={userInput}
                onChange={handleInputChange}
                onPaste={handlePaste}
                className="opacity-0 absolute top-0 left-0 w-0 h-0"
                autoFocus
                spellCheck={false}
                autoComplete="off"
            />

            {!isActive && timeLeft === durationSeconds && (
                <div className="text-center text-zinc-500">
                    Start typing to begin...
                </div>
            )}
        </div>
    );
}
