"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/Dialog";
import { Button } from "@/components/ui";
import { CheckCircle2, Sparkles } from "lucide-react";

interface CompletionCelebrationModalProps {
  open: boolean;
  onClose: () => void;
}

export function CompletionCelebrationModal({ open, onClose }: CompletionCelebrationModalProps) {
  useEffect(() => {
    if (open) {
      // Trigger confetti animation
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min;
      }

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        
        // Launch confetti from left
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        
        // Launch confetti from right
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);

      // Cleanup
      return () => clearInterval(interval);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px] text-center">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="relative">
              <CheckCircle2 className="h-16 w-16 text-primary-600 animate-in zoom-in-95 duration-300" />
              <Sparkles className="h-8 w-8 text-primary-400 absolute -top-2 -right-2 animate-pulse" />
            </div>
          </div>
          <DialogTitle className="text-2xl font-bold text-text-primary">
            Well Done!
          </DialogTitle>
          <DialogDescription className="text-base text-text-secondary mt-2">
            Congratulations! You've completed scoring all requirements for all vendors.
            <br />
            <br />
            Your thorough evaluation will help make the best vendor selection decision.
            Great work on staying organized and completing this comprehensive review!
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6">
          <Button
            onClick={onClose}
            variant="primary"
            className="w-full sm:w-auto"
          >
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

