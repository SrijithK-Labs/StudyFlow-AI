"use client";

import React, { useState, useEffect } from "react";

interface TypewriterProps {
    text: string;
    speed?: number;
    delay?: number;
    onComplete?: () => void;
}

const Typewriter: React.FC<TypewriterProps> = ({ text, speed = 5, delay = 0, onComplete }) => {
    const [displayedText, setDisplayedText] = useState("");
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (currentIndex === 0) {
            const timeout = setTimeout(() => {
                setCurrentIndex(1);
            }, delay);
            return () => clearTimeout(timeout);
        }
    }, [delay, currentIndex]);

    useEffect(() => {
        if (currentIndex > 0 && currentIndex <= text.length) {
            const timeout = setTimeout(() => {
                setDisplayedText(text.slice(0, currentIndex));
                setCurrentIndex(prev => prev + 1);
            }, speed);

            return () => clearTimeout(timeout);
        } else if (currentIndex > text.length) {
            onComplete?.();
        }
    }, [currentIndex, text, speed, onComplete]);

    return <span>{displayedText}</span>;
};

export default Typewriter;
