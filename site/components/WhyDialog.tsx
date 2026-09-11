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
 * Two short paragraphs and a send-off. There is no close button: the dialog
 * ends in a button that closes it, and a second way out in the corner competes
 * with the one that is actually fun to press. Escape and the overlay still
 * work.
 *
 * The GIF is served from `public/`, not hotlinked to Giphy. A third-party host
 * in the page is a request we do not control, on a site whose whole pitch is
 * that it does not phone anywhere.
 */
export function WhyDialog({ open, onOpenChange }: WhyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        {/* Capped by height rather than width so a wide GIF cannot decide how
            wide the dialog is. */}
        <img
          src="/why.gif"
          alt=""
          className="h-36 w-full rounded-lg object-cover"
        />

        <DialogHeader>
          <DialogTitle>Whaaat is all this?</DialogTitle>
          <DialogDescription>Friction, mostly.</DialogDescription>
        </DialogHeader>

        <div className="text-muted-foreground flex flex-col gap-3 text-sm leading-relaxed">
          <p>
            I kept hitting the same friction points building my own things, so I started
            building small tools to get past them. That is all this is: a pile of solutions to
            problems I have actually had.
          </p>
          <p>
            They are packaged up and shared because that is more fun than keeping them in a
            drawer. If one of them saves you an afternoon, good.
          </p>
        </div>

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
