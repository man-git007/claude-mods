export type Phase = 'off' | 'plan' | 'exec'

declare module 'claude-code' {
  interface PluginState {
    'phase-switch': { phase: Phase; planPath: string }
  }
}
