/**
 * `discuss` — one multi-turn planning conversation with the tech-lead planner.
 *
 * The session is a state machine (`running → awaiting → done|aborted|failed`),
 * and the model layer's selectors are what let the widgets render the state
 * rather than re-deriving it from the frame log in three places.
 */

export {
  assumptions,
  type DiscussFrame,
  type DiscussOptions,
  type DiscussSession,
  type DiscussSettings,
  type DiscussState,
  describeSession,
  discussKeys,
  type Expects,
  expects,
  isSessionLive,
  isThinking,
  MAX_PINS,
  type PinnedFileInfo,
  type ProposedSpec,
  proposedSpecs,
  readUpload,
  type StartDiscussRequest,
  sessionTone,
  type UploadedPin,
  UploadRejected,
  uploadDisplayPath,
} from "./model";
