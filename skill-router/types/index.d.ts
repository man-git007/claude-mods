export type Phase = 'off' | 'plan' | 'exec'

declare module 'claude-code' {
  interface PluginState {
    'skill-router': { phase: Phase }
  }
}
