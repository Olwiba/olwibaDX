// Thin server fns around @olwiba/docs feedback helpers. TanStack Start only
// compiles server fns from app source, so every docs site carries this file
// and passes the two fns to <FeedbackSidebarItem>.
import { createServerFn } from '@tanstack/react-start';
import {
  deliverFeedback,
  feedbackEnabled,
  validateFeedbackSubmission,
  type FeedbackResult,
} from '@olwiba/docs/feedback';

export const getFeedbackConfig = createServerFn({ method: 'GET' }).handler(async () =>
  feedbackEnabled(),
);

export const submitFeedback = createServerFn({ method: 'POST' })
  .inputValidator(validateFeedbackSubmission)
  .handler(async ({ data }): Promise<FeedbackResult> => deliverFeedback(data));
