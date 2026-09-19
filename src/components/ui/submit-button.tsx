"use client";

import { useFormStatus } from "react-dom";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string };

export function SubmitButton({ children, pendingText = "Salvando...", className = "btn-primary", disabled, ...rest }: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={className} {...rest}>
      {pending ? pendingText : children}
    </button>
  );
}
