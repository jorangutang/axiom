/** Default tokens for kit builders — override per call where needed. */

export const kitTheme = {
  bgCard: '#14141c',
  border: '#2a2a38',
  textPrimary: '#ececf2',
  textMuted: '#9898a8',
  accent: '#6ea8ff',
  accentPressed: '#4d87e8',
  fontTitle: '600 17px ui-sans-serif, system-ui, sans-serif',
  fontBody: '400 14px ui-sans-serif, system-ui, sans-serif',
  fontButton: '600 14px ui-sans-serif, system-ui, sans-serif',
  fontBadge: '600 11px ui-sans-serif, system-ui, sans-serif',
  radiusCard: 14,
  radiusButton: 10,
  shadowCard: { x: 0, y: 10, blur: 28, color: 'rgba(0,0,0,0.4)' } as const,
}
