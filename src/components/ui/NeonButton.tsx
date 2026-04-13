"use client";

import { cva, type VariantProps } from "class-variance-authority";
import React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative group border text-foreground mx-auto text-center rounded-full transition-all duration-200",
  {
    variants: {
      variant: {
        default: "bg-blue-500/5 hover:bg-blue-500/0 border-blue-500/20",
        solid:
          "bg-blue-500 hover:bg-blue-600 text-white border-transparent hover:border-white/50",
        ghost:
          "border-transparent bg-transparent hover:border-zinc-600 hover:bg-white/10",
        cyan: "bg-cyan-500/10 hover:bg-cyan-500/5 border-cyan-500/30 text-cyan-300",
        green:
          "bg-green-500/10 hover:bg-green-500/5 border-green-500/30 text-green-300",
        red: "bg-red-500/10 hover:bg-red-500/5 border-red-500/30 text-red-300",
        purple:
          "bg-purple-500/10 hover:bg-purple-500/5 border-purple-500/30 text-purple-300",
      },
      size: {
        default: "px-7 py-1.5 text-sm",
        sm: "px-4 py-0.5 text-xs",
        lg: "px-10 py-2.5 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonVariant =
  | "default"
  | "solid"
  | "ghost"
  | "cyan"
  | "green"
  | "red"
  | "purple";

const glowColors: Record<ButtonVariant, string> = {
  default: "via-blue-500",
  solid: "via-blue-400",
  ghost: "via-white/40",
  cyan: "via-cyan-400",
  green: "via-green-400",
  red: "via-red-400",
  purple: "via-purple-400",
};

export interface NeonButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  neon?: boolean;
}

const NeonButton = React.forwardRef<HTMLButtonElement, NeonButtonProps>(
  (
    { className, neon = true, size, variant = "default", children, ...props },
    ref,
  ) => {
    const resolvedVariant: ButtonVariant =
      (variant as ButtonVariant) ?? "default";
    const glow = glowColors[resolvedVariant] ?? glowColors.default;

    return (
      <button
        type="button"
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      >
        <span
          className={cn(
            "absolute h-px opacity-0 group-hover:opacity-100 transition-all duration-500 ease-in-out inset-x-0 inset-y-0 bg-gradient-to-r w-3/4 mx-auto from-transparent to-transparent hidden",
            neon && "block",
            glow,
          )}
        />
        {children}
        <span
          className={cn(
            "absolute group-hover:opacity-30 transition-all duration-500 ease-in-out inset-x-0 h-px -bottom-px bg-gradient-to-r w-3/4 mx-auto from-transparent to-transparent hidden",
            neon && "block",
            glow,
          )}
        />
      </button>
    );
  },
);

NeonButton.displayName = "NeonButton";

export { buttonVariants, NeonButton };
