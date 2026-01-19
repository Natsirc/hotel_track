"use client";

import { useState } from "react";

type PopupProps = {
  tone: "success" | "error" | "warning";
  title: string;
  message: string;
  onClose?: () => void;
};

const toneStyles: Record<PopupProps["tone"], string> = {
  success: "border-[rgba(122,28,172,0.35)] bg-[rgba(235,211,248,0.85)] text-[var(--plum)]",
  error: "border-[rgba(122,28,172,0.35)] bg-[rgba(122,28,172,0.12)] text-[var(--plum)]",
  warning: "border-[rgba(173,73,225,0.35)] bg-[rgba(173,73,225,0.12)] text-[var(--plum)]",
};

export default function Popup({ tone, title, message, onClose }: PopupProps) {
  const [open, setOpen] = useState(true);

  if (!open) return null;

  return (
    <div className="popup-overlay">
      <div className={`popup-card ${toneStyles[tone]}`}>
        <div className="popup-header">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onClose?.();
            }}
            className="popup-close"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="text-sm">{message}</p>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onClose?.();
          }}
          className="popup-action"
        >
          OK
        </button>
      </div>
    </div>
  );
}
