'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  fireConfetti,
} from '@olwiba/cn';

export interface WhyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The story behind the toolkit, for anyone who clicks "Whaaat?".
 *
 * Deliberately plain-spoken. None of this is a pitch — the honest version of
 * why these tools exist is more interesting than a feature list, and it is the
 * one thing a visitor cannot get from the command reference.
 */
export function WhyDialog({ open, onOpenChange }: WhyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Whaaat is all this?</DialogTitle>
          <DialogDescription>
            The short version: it is the stuff I kept rebuilding.
          </DialogDescription>
        </DialogHeader>

        <div className="text-muted-foreground flex flex-col gap-3 text-sm leading-relaxed">
          <p>
            Every site and tool I build needs the same unglamorous things — checking an
            environment against its example, generating icons, cleaning up worktrees, getting a
            banner to print without eating half the terminal. I kept writing them again,
            slightly differently, and then fixing the same bugs twice.
          </p>
          <p>
            So this is that pile, cleaned up. Almost all of it started as a solution to a
            problem I hit in the middle of building something else. A few pieces are here
            because I got annoyed enough to do it properly once.
          </p>
          <p>
            I am sharing it because it is more fun that way. If it saves you an afternoon, or
            spares you a bug I have already paid for, that is the whole idea — better tools,
            less yak-shaving, more shipping.
          </p>
        </div>

        {/* Centred and on its own row: it is the only action here, and it is a
            send-off rather than a confirmation. */}
        <div className="flex justify-center pt-2">
          <Button
            onClick={() => {
              onOpenChange(false);
              // Fires from the bottom-left and bottom-right corners by default.
              fireConfetti();
            }}
          >
            Let&apos;s ship!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
