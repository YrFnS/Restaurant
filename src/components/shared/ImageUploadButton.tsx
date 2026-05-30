'use client';

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

interface ImageUploadButtonProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function ImageUploadButton({
  value,
  onChange,
  label = 'Click to upload',
  className = '',
  size = 'md',
}: ImageUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(value || '');
  const [dragOver, setDragOver] = useState(false);

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  };

  const handleFile = async (file: File) => {
    // Validate type
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.type)) {
      alert('Invalid file type. Allowed: JPEG, PNG, GIF, WebP, SVG');
      return;
    }
    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File too large. Max: 5MB');
      return;
    }

    setUploading(true);
    try {
      // Show local preview immediately
      const localPreview = URL.createObjectURL(file);
      setPreview(localPreview);

      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        onChange(data.url);
        setPreview(data.url);
      } else {
        const err = await res.json();
        alert(err.error || 'Upload failed');
        setPreview(value);
      }
    } catch {
      alert('Upload failed');
      setPreview(value);
    }
    setUploading(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setPreview('');
    if (inputRef.current) inputRef.current.value = '';
  };

  React.useEffect(() => {
    if (value) setPreview(value);
  }, [value]);

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
      />
      {preview ? (
        <div
          className={`relative ${sizeClasses[size]} rounded-lg overflow-hidden border border-border group cursor-pointer`}
          onClick={() => inputRef.current?.click()}
        >
          <img
            src={preview}
            alt="Preview"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
            >
              <Upload className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={handleRemove}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <div
          className={`${sizeClasses[size]} rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors
            ${dragOver ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-900/20' : 'border-muted-foreground/30 hover:border-amber-500 hover:bg-amber-50/50 dark:hover:bg-amber-900/10'}
            ${uploading ? 'pointer-events-none' : ''}`}
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {uploading ? (
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
              <span className="text-[10px] text-muted-foreground mt-1 text-center px-1">{label}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
