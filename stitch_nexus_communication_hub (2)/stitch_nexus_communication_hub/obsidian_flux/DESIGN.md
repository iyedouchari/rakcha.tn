---
name: Obsidian Flux
colors:
  surface: '#121316'
  surface-dim: '#121316'
  surface-bright: '#38393c'
  surface-container-lowest: '#0d0e11'
  surface-container-low: '#1a1b1e'
  surface-container: '#1f1f23'
  surface-container-high: '#292a2d'
  surface-container-highest: '#343538'
  on-surface: '#e3e2e6'
  on-surface-variant: '#cfc2d6'
  inverse-surface: '#e3e2e6'
  inverse-on-surface: '#2f3033'
  outline: '#988d9f'
  outline-variant: '#4d4354'
  surface-tint: '#ddb7ff'
  primary: '#ddb7ff'
  on-primary: '#490080'
  primary-container: '#b76dff'
  on-primary-container: '#400071'
  inverse-primary: '#842bd2'
  secondary: '#44e2cd'
  on-secondary: '#003731'
  secondary-container: '#03c6b2'
  on-secondary-container: '#004d44'
  tertiary: '#ffb2b7'
  on-tertiary: '#67001b'
  tertiary-container: '#ff516a'
  on-tertiary-container: '#5b0017'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#f0dbff'
  primary-fixed-dim: '#ddb7ff'
  on-primary-fixed: '#2c0051'
  on-primary-fixed-variant: '#6900b3'
  secondary-fixed: '#62fae3'
  secondary-fixed-dim: '#3cddc7'
  on-secondary-fixed: '#00201c'
  on-secondary-fixed-variant: '#005047'
  tertiary-fixed: '#ffdadb'
  tertiary-fixed-dim: '#ffb2b7'
  on-tertiary-fixed: '#40000d'
  on-tertiary-fixed-variant: '#92002a'
  background: '#121316'
  on-background: '#e3e2e6'
  surface-variant: '#343538'
typography:
  display-sm:
    fontFamily: Geist
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  chat-text:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: 0px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  server-rail-width: 72px
  sidebar-width: 240px
  member-list-width: 240px
  gutter: 16px
  stack-sm: 4px
  stack-md: 8px
  stack-lg: 16px
---

## Brand & Style

The design system is centered on a "Technical Refinement" aesthetic—a sophisticated evolution of the gaming-chat trope. It targets developers, high-performance teams, and creative communities who require a focused, low-friction environment. 

The style merges **Minimalism** with **Glassmorphism**. It utilizes deep, layered surfaces to create a sense of architectural depth without relying on heavy shadows. The emotional response is one of calm productivity and high-speed reliability. Interface elements remain understated, allowing user-generated content and status indicators to provide the primary visual energy.

## Colors

The palette is built on a "Triple-Black" architecture to provide maximum visual hierarchy in a dark environment. 
- **Primary (Electric Purple):** Reserved for high-intent actions, active states, and brand-critical moments.
- **Secondary (Mint Green):** Used primarily for "Online" status and success feedback, providing a high-contrast pop against the charcoal base.
- **Tertiary (Rose):** Used for "Do Not Disturb" states and destructive actions.
- **Surface Strategy:** Use `#1E1F22` for the furthest background (Server List), `#2B2D31` for primary navigation (Channel List), and `#313338` for the content area (Chat). This "Lighter as you go deeper" approach guides the user's focus toward the message pane.

## Typography

This design system prioritizes legibility in high-density text environments. 
- **Headlines:** Use **Geist** for a technical, precise feel in headers and navigation labels.
- **Body:** Use **Inter** for the main chat window. Its tall x-height ensures readability even at smaller scales during rapid-fire messaging.
- **Status & Labels:** Use the `label-md` token for category headers in sidebars (e.g., "TEXT CHANNELS") with wide letter-spacing to distinguish navigation from content.

## Layout & Spacing

The layout follows a three-to-four pane horizontal stack. 
1. **Server Rail (Fixed):** 72px width, centered icons.
2. **Navigation Sidebar (Fixed):** 240px width, containing nested channel lists.
3. **Chat Area (Fluid):** Expands to fill available space.
4. **Member List (Fixed/Collapsible):** 240px width on the right.

Use a **stack-md (8px)** base unit for most internal component padding. Chat messages should have a 16px horizontal padding to ensure text doesn't touch the edges of the fluid pane.

## Elevation & Depth

Depth is achieved through **Tonal Layering** and **Glassmorphism**, not shadows.
- **Level 0 (#1E1F22):** The "Floor." Used for the sidebar rail.
- **Level 1 (#2B2D31):** Primary navigation containers.
- **Level 2 (#313338):** The main content area.
- **Overlays (Modals/Popouts):** Use a semi-transparent version of the primary background (`rgba(30, 31, 34, 0.8)`) with a `20px` backdrop-blur and a `1px` border of `white/10%`. 

Avoid drop shadows on buttons or cards to maintain the clean, technical aesthetic. Only use a subtle `0px 4px 12px rgba(0,0,0,0.4)` for floating context menus.

## Shapes

The design system utilizes **Rounded** shapes to balance the technical "dark mode" with an approachable community feel.
- **Standard Elements:** 8px (Buttons, Inputs, Chat Bubbles).
- **Large Elements:** 16px (Modals, Large Cards).
- **Avatars:** Use a "Squircle" (interpolated rounded square) rather than a perfect circle to differentiate from competitors.
- **Active Indicators:** Vertical pills for active channel markers (4px wide, rounded).

## Components

### Buttons
- **Primary:** Background `#A855F7`, white text. No border.
- **Secondary:** Background `#404249`, white text. Hover state shifts to `#4F545C`.
- **Ghost:** Transparent background, primary color text. Used for low-priority actions.

### Chat Messages
- **Structure:** Compact layout. Avatar (40x40 squircle), Name (headline-sm), Timestamp (body-sm, low opacity).
- **Interaction:** On hover, a subtle background highlight `#2E3035` appears across the full width, and a small action bar (Reply, React, Edit) appears in the top right of the message.

### Status Indicators
- **Online:** `#2DD4BF` ring or solid dot.
- **Idle:** `#FBBF24` crescent moon shape.
- **DND:** `#F43F5E` horizontal bar inside a circle.

### Input Fields
- **Chat Bar:** Background `#383A40`, 8px rounding, `body-md` text. Placeholder text should be 40% opacity. 
- **Focus State:** No outer glow; use a `1px` solid border of the Primary color.

### Sidebar Items
- **Active Channel:** Background `#3F4147`, text color white. A 4px vertical "pill" of Primary color on the far left edge.
- **Inactive Channel:** No background, text color `rgba(255,255,255,0.6)`. Hover state `rgba(255,255,255,0.8)`.