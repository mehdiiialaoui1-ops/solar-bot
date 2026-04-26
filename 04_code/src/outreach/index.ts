/**
 * Module outreach - exports publics.
 */

export type {
  PromptVariables,
  EmailGenere,
  AnthropicResponse,
  LemlistLead,
  LemlistAddLeadResponse,
  OutreachInput,
  OutreachResult,
} from './types'

export { OutreachError } from './types'

// Claude
export {
  ANTHROPIC_ENDPOINT,
  DEFAULT_MODEL,
  LIMITE_MOTS,
  VARIABLES_REQUISES,
  substituerVariables,
  appelerClaudeApi,
  parserEmail,
  compterMots,
  genererEmail,
} from './claude-email'

// Lemlist
export {
  LEMLIST_BASE,
  buildAuthHeader,
  buildAddLeadUrl,
  addLead,
} from './lemlist'

// Orchestrateur
export { runOutreach } from './cascade'
