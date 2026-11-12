# TissueAI UI/UX Redesign Plan

## Reference Analysis

### Reference App (D:\LLM) - Key Patterns:
- **Tailwind CSS 3.4** + extensive custom CSS component layer (2159 lines in globals.css)
- **Bottom dock navigation** (macOS-style pill dock) instead of sidebar
- **3-tier glassmorphism**: ambient bg → glass-panel → glass-card
- **Floating ambient orbs** with slow animation (15s oscillation)
- **Custom window controls** (decorations: false)
- **CSS variable system** for theming (--text-1 to --text-5, --border-1 to --border-3, --bg-1 to --bg-4)
- **Custom animations**: fadeIn, slideUp, scaleIn, pageEnter, orbFloat, ambientShift
- **Typography**: Inter (body) + JetBrains Mono (code), hero numbers (48px/700), section labels (10px/600/uppercase)
- **Color scheme**: Deep blue-black surfaces (#0a0d14 to #253050), primary blue (#5BA8F5)

### Current TissueAI - Gaps:
- Basic glassmorphism (only glass-panel, glass-card)
- Sidebar navigation (icon-only rail, functional but not premium)
- Limited animations (only drift for ambient bg)
- No floating orbs
- Basic typography hierarchy
- No custom scrollbars styled consistently
- Detection page feels utilitarian, not premium

## Redesign Strategy

### Phase 1: CSS Design System Overhaul (`index.css`)

**1.1 Enhanced CSS Variables**
```css
:root {
  /* Text opacity hierarchy */
  --text-1: rgba(255, 255, 255, 0.92);
  --text-2: rgba(255, 255, 255, 0.72);
  --text-3: rgba(255, 255, 255, 0.50);
  --text-4: rgba(255, 255, 255, 0.32);
  --text-5: rgba(255, 255, 255, 0.18);
  
  /* Border hierarchy */
  --border-1: rgba(255, 255, 255, 0.08);
  --border-2: rgba(255, 255, 255, 0.04);
  --border-3: rgba(255, 255, 255, 0.02);
  
  /* Surface hierarchy */
  --surface-0: #070a10;
  --surface-1: rgba(12, 17, 28, 0.85);
  --surface-2: rgba(18, 25, 40, 0.75);
  --surface-3: rgba(25, 35, 55, 0.65);
  --surface-4: rgba(35, 48, 75, 0.55);
}
```

**1.2 Floating Orb System**
- 3 ambient orbs with different colors (blue, purple, cyan)
- Slow float animation (15-25s oscillation)
- Large blurred circles (400-600px)
- Positioned behind all content

**1.3 Enhanced Glass Components**
- `.glass-panel`: blur(25px) saturate(1.3), gradient overlay, top highlight line
- `.glass-card`: blur(16px) saturate(1.15), hover lift effect (translateY(-2px) scale(1.005))
- `.glass-card-static`: Non-interactive glass container
- `.glass-input`: Focused glow ring effect
- Top highlight: `::before` pseudo-element with linear gradient

**1.4 Custom Animations**
- `fadeIn`: 0.3s ease-out opacity
- `slideUp`: 0.35s cubic-bezier entrance
- `scaleIn`: 0.2s ease-out scale
- `pageEnter`: Full page entrance animation
- `orbFloat`: 15s oscillation for floating orbs
- `ambientShift`: 20s color cycle for ambient gradients
- `glowPulse`: Subtle glow pulse for active elements

**1.5 Button System**
- `.btn-accent`: Primary blue gradient with glow hover
- `.btn-glass`: Secondary glass button
- `.btn-ghost`: Minimal text button
- `.btn-danger`: Destructive red button

**1.6 Form Elements**
- `.glass-input`: Styled select/input with focus ring
- `.toggle-track` / `.toggle-thumb`: Custom toggle switches
- Range slider accent styling

**1.7 Typography Scale**
- Hero numbers: 48px/700 weight, gradient text
- Section labels: 10px/600/uppercase/0.12em tracking
- Body: 13-15px Inter
- Code: JetBrains Mono

### Phase 2: Layout Redesign

**2.1 Option A: Bottom Dock Navigation**
- Replace sidebar with macOS-style bottom dock
- Pill-shaped dock with blur backdrop
- Icons with labels on hover
- Active state: glow effect
- Window controls in titlebar

**2.2 Option B: Enhanced Sidebar (Keep current, improve)**
- Wider sidebar (64px → 80px)
- Add subtle gradient background
- Improve active state with glow
- Add user avatar at bottom
- Add version badge

**Recommendation**: Start with Option B (enhanced sidebar) as it's less disruptive. Can migrate to bottom dock later.

**2.3 Titlebar Enhancement**
- Custom window controls (minimize, maximize, close)
- Drag region
- Search button with keyboard shortcut hint
- Notification bell with badge

### Phase 3: Page Redesign

**3.1 Home Page**
- Hero section with gradient text and stats
- Tool cards with gradient accent overlays on hover
- System metrics with animated progress rings
- Quick actions section
- Recent activity feed

**3.2 Detection Page**
- Split view: Left controls panel + Right image viewport
- Enhanced model selector with search
- Confidence/NMS sliders with value display
- Results table with sorting and filtering
- Annotated image with zoom/pan
- Export options (CSV, PNG, PDF)

**3.3 Settings Page**
- Card-based sections
- Toggle switches for options
- Theme selector (Dark/Light)
- Processing configuration
- About section with version info

### Phase 4: Micro-interactions

**4.1 Hover Effects**
- Card lift on hover (translateY(-2px))
- Border glow on hover
- Icon scale on hover
- Background brightness change

**4.2 Transitions**
- Page transitions (fade + slide)
- Modal transitions (scale + fade)
- Toast notifications (slide in from top)
- Loading states (skeleton screens)

**4.3 Feedback**
- Button press feedback (scale down)
- Success/error states with color
- Progress indicators for long operations
- Toast notifications for actions

## Implementation Order

1. **CSS Design System** (index.css) - Foundation
2. **Layout Components** (MainLayout, Sidebar, Header) - Structure
3. **Home Page** - First impression
4. **Detection Page** - Core functionality
5. **Settings Page** - Configuration
6. **Activation Page** - License flow
7. **Micro-interactions** - Polish

## Files to Modify

### CSS
- `src/styles/index.css` - Complete rewrite with new design system

### Components
- `src/components/Layout/MainLayout.tsx` - Enhanced layout
- `src/components/Layout/Sidebar.tsx` - Enhanced navigation
- `src/components/Layout/Header.tsx` - Enhanced titlebar
- `src/components/pages/Home.tsx` - Redesigned dashboard
- `src/components/pages/Settings.tsx` - Redesigned settings
- `src/components/pages/Activation.tsx` - Enhanced activation
- `src/components/tools/Detection.tsx` - Enhanced detection UI

### Config
- `tailwind.config.js` - May need for Tailwind v3 (if downgrading)
- `index.html` - Add Inter font, JetBrains Mono

## Success Metrics

- [ ] Glassmorphism effects match reference quality
- [ ] Animations are smooth (60fps)
- [ ] Typography hierarchy is clear
- [ ] Color scheme is cohesive
- [ ] Hover states provide feedback
- [ ] Page transitions are smooth
- [ ] Mobile-responsive (if applicable)
- [ ] Accessibility (keyboard navigation, screen readers)
