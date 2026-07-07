"use client";

import React from 'react';
import { format, isToday, isYesterday } from 'date-fns';

interface DateSeparatorProps {
    date: Date | string;
}

export default function DateSeparator({ date }: DateSeparatorProps) {
    const d = typeof date === 'string' ? new Date(date) : date;

    let label = format(d, 'MMMM d, yyyy');
    if (isToday(d)) label = "Today";
    else if (isYesterday(d)) label = "Yesterday";

    return (
        <div className="flex items-center gap-4 my-8 relative">
            <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-black text-foreground/30 bg-background px-4 py-1 rounded-full border border-white/5 shadow-sm">
                {label}
            </span>
            <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
    );
}
