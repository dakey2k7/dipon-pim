// Separate Datei für Theme-Typen und Default-Werte
// Kein Import aus themeStore oder ThemeEditorPage – verhindert Zirkularität

export interface ThemeConfig {
  id:string; name:string; isDefault?:boolean
  bgPrimary:string; bgSecondary:string; bgCard:string
  accentColor:string; textPrimary:string; textSecondary:string; textMuted:string; borderColor:string
  glowEnabled:boolean; glowIntensity:number; glowColor:string; glowSpread:number
  glassEnabled:boolean; glassBlur:number; glassOpacity:number; glassBorder:boolean
  animatedBorder:boolean; animatedBg:boolean; cardHoverScale:boolean; cardHover3d:boolean
  radiusCard:number; radiusButton:number; radiusBadge:number; radiusInput:number
  fontFamily:string; fontSizeBase:number; fontWeightBody:number
  bgType:'solid'|'gradient'|'image'|'mesh'
  bgGradient:string; bgImageUrl:string; bgImageBlur:number; bgImageDim:number; bgImageTile:boolean
  dotGrid:boolean; dotGridColor:string; dotGridSize:number
  chartLineColor:string; chartGlowEnabled:boolean; chartGlowStrength:number; chartAreaOpacity:number; chartFontSize:number
  scrollbarWidth:number; scrollbarColor:string; scrollbarTrack:string
  bentoGap:number; bentoRadius:number
}

export const DEFAULT_THEME: ThemeConfig = {
  id:'default', name:'DIPON Dark', isDefault:true,
  bgPrimary:'#0c0e1a', bgSecondary:'#11142a', bgCard:'rgba(255,255,255,0.04)',
  accentColor:'#8b5cf6', textPrimary:'#f8fafc', textSecondary:'#94a3b8', textMuted:'#475569',
  borderColor:'rgba(255,255,255,0.08)',
  glowEnabled:true, glowIntensity:60, glowColor:'#8b5cf6', glowSpread:20,
  glassEnabled:true, glassBlur:16, glassOpacity:4, glassBorder:true,
  animatedBorder:false, animatedBg:false, cardHoverScale:true, cardHover3d:false,
  radiusCard:16, radiusButton:12, radiusBadge:8, radiusInput:10,
  fontFamily:'Inter', fontSizeBase:14, fontWeightBody:400,
  bgType:'solid', bgGradient:'', bgImageUrl:'', bgImageBlur:0, bgImageDim:50, bgImageTile:false,
  dotGrid:true, dotGridColor:'#6366f1', dotGridSize:24,
  chartLineColor:'#8b5cf6', chartGlowEnabled:true, chartGlowStrength:40, chartAreaOpacity:25, chartFontSize:9,
  scrollbarWidth:4, scrollbarColor:'#8b5cf6', scrollbarTrack:'#1e2035',
  bentoGap:16, bentoRadius:16,
}
