"use client";

import { AlertTriangle } from "lucide-react";
import { Button, Modal } from "./ui";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({ open, title, description, confirmLabel = "Confirmar", danger = false, onCancel, onConfirm }: ConfirmDialogProps) {
  return <Modal open={open} title={title} subtitle="Confirme para continuar." onClose={onCancel} footer={<><Button variant="ghost" onClick={onCancel}>Cancelar</Button><Button variant={danger ? "danger" : "primary"} onClick={() => void onConfirm()}>{confirmLabel}</Button></>}>
    <div className={`confirm-dialog-message ${danger ? "danger" : "warning"}`}><span><AlertTriangle size={21} /></span><p>{description}</p></div>
  </Modal>;
}
