"use client";

import React, { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered,
  Link,
  Undo,
  Redo
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  isRTL?: boolean;
}

export function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = "Start writing...", 
  className,
  disabled = false,
  isRTL = false
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const execCommand = (command: string, value?: string) => {
    if (disabled || typeof document === 'undefined') return;
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const handleInput = () => {
    if (editorRef.current && !isComposingRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = () => {
    isComposingRef.current = false;
    handleInput();
  };

  const insertLink = () => {
    if (typeof window === 'undefined') return;
    const url = prompt('Enter URL:');
    if (url) {
      execCommand('createLink', url);
    }
  };

  const formatList = (type: 'bullet' | 'number') => {
    const command = type === 'bullet' ? 'insertUnorderedList' : 'insertOrderedList';
    execCommand(command);
  };

  const toolbarButtons = [
    { 
      icon: Bold, 
      command: 'bold', 
      title: 'Bold',
    },
    { 
      icon: Italic, 
      command: 'italic', 
      title: 'Italic',
    },
    { 
      icon: Underline, 
      command: 'underline', 
      title: 'Underline',
    },
    { 
      icon: List, 
      action: () => formatList('bullet'), 
      title: 'Bullet List',
    },
    { 
      icon: ListOrdered, 
      action: () => formatList('number'), 
      title: 'Numbered List',
    },
    { 
      icon: Link, 
      action: insertLink, 
      title: 'Insert Link',
    },
    { 
      icon: Undo, 
      command: 'undo', 
      title: 'Undo',
    },
    { 
      icon: Redo, 
      command: 'redo', 
      title: 'Redo',
    },
  ];

  return (
    <div className={cn(
      "overflow-hidden rounded-lg border border-gray-200 bg-white",
      className
    )}>
      {/* Simple Toolbar */}
      <div className="flex items-center gap-1 border-b border-gray-200 p-2">
        {toolbarButtons.map((button, index) => (
          <Button
            key={index}
            variant="ghost"
            size="sm"
            onClick={() => button.action ? button.action() : execCommand(button.command!)}
            disabled={disabled}
            className="size-8 p-0 hover:bg-gray-100"
            title={button.title}
          >
            <button.icon className="size-4" />
          </Button>
        ))}
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={handleInput}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        className={cn(
          "min-h-[200px] p-4 focus:outline-none",
          "prose prose-sm max-w-none",
          "prose-headings:mb-3 prose-headings:mt-4",
          "prose-p:mb-3 prose-p:leading-relaxed",
          "prose-ol:list-decimal prose-ul:list-disc prose-li:mb-1",
          "prose-blockquote:border-l-2 prose-blockquote:px-4",
          disabled && "cursor-not-allowed bg-gray-50 opacity-50",
          isRTL && "text-right"
        )}
        style={{ direction: isRTL ? 'rtl' : 'ltr' }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
    </div>
  );
}