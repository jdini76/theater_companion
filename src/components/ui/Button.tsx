import React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "success" | "warn";
  size?: "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "font-bold rounded-xl transition-colors cursor-pointer border-0",
          {
            // Variant styles
            "bg-accent-cyan text-blue-900 hover:bg-opacity-90":
              variant === "primary",
            "bg-slate-700 text-light hover:bg-slate-600": variant === "secondary",
            "border border-dark bg-transparent text-light hover:bg-dark-panel":
              variant === "outline",
            "bg-accent-green text-emerald-900 hover:bg-opacity-90":
              variant === "success",
            "bg-warn-amber text-yellow-900 hover:bg-opacity-90": variant === "warn",
            // Size styles
            "px-3 py-1.5 text-sm": size === "sm",
            "px-4 py-2 text-base": size === "md",
            "px-6 py-3 text-lg": size === "lg",
            // Disabled state
            "disabled:opacity-50 disabled:cursor-not-allowed": true,
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
