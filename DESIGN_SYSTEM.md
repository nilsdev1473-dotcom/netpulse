# DESIGN_SYSTEM.md — NetPulse

**Vision:** TRON Security Operations Center — a network monitor that feels like you're running ops in a sci-fi film, not checking your WiFi password.

**Signature:** Electric cyan #00E8ED as the ONE accent. Nothing else. Not purple, not green. Cyan only.
**Reference:** TRON Legacy UI + Cyberpunk 2077 HUD + Wireguard dashboard vibes
**Avoid:** Rounded pill buttons everywhere, gradient cards, glass morphism overuse, purple (NeuralBoard + StartupSignal = retired)

---

## Colors

| Role | Value | Notes |
|------|-------|-------|
| Background | `#050507` | Darker than standard — feels like terminal |
| Surface | `#0D0D10` | Cards/panels |
| Surface raised | `#141418` | Hover states, active items |
| Border | `rgba(0,232,237,0.1)` | Cyan-tinted, not white |
| Border bright | `rgba(0,232,237,0.25)` | Active elements |
| Text primary | `rgba(255,255,255,0.92)` | |
| Text secondary | `rgba(0,232,237,0.7)` | Cyan-tinted secondary |
| Text dim | `rgba(255,255,255,0.35)` | Labels, hints |
| **Accent** | `#00E8ED` | Electric cyan — the ONLY accent |
| Accent dim | `rgba(0,232,237,0.12)` | Backgrounds |
| Accent glow | `rgba(0,232,237,0.3)` | Drop shadows |
| Success | `#00FF94` | High speed, clean connection |
| Warning | `#FFB800` | Medium issues |
| Danger | `#FF3B3B` | Low speed, VPN issues, threats |

---

## Typography

- **Headings:** `Space Grotesk` — technical, geometric, futuristic
- **Body:** `Space Grotesk` — consistent
- **Numbers/metrics:** `JetBrains Mono` — monospace for ALL speed numbers, IPs, ms values
- **Terminal text:** `JetBrains Mono` — VPN analyzer, traffic feed

---

## Key Component Patterns

### Speed Gauge (custom SVG arc)
- SVG-based radial gauge, NOT Recharts
- Thin dark track (rgba(0,232,237,0.1))
- Thick cyan fill that sweeps as speed increases
- Outer glow: drop-shadow(0 0 20px #00E8ED)
- Center: large monospace number + unit
- Animated: smooth spring transition on value change

### Scan-line Effect (active testing state)
```css
background: repeating-linear-gradient(
  0deg,
  transparent,
  transparent 2px,
  rgba(0,232,237,0.02) 2px,
  rgba(0,232,237,0.02) 4px
);
```

### Pulsing Status Dot
- Online: `#00FF94` with pulse animation
- Testing: `#00E8ED` with fast pulse
- Error: `#FF3B3B` with slow pulse

### NeonButton (from 21st.dev prompt — already defined)
- Use the neon-btn class already created
- Variant: cyan for primary actions, default for secondary

### CpuArchitecture (from 21st.dev prompt — already defined)  
- Show during active speed test as loading indicator
- Color: `rgba(0,232,237,0.6)` for cyan theme

### Card Pattern
```css
background: #0D0D10;
border: 1px solid rgba(0,232,237,0.1);
border-radius: 4px; /* SHARP corners — cyber not soft */
```
Note: NO border-radius-xl. Sharp or slightly rounded (4px max). This is NOT a SaaS dashboard.

### Active/Scanning card
```css
border-color: rgba(0,232,237,0.35);
box-shadow: 0 0 20px rgba(0,232,237,0.08), inset 0 0 20px rgba(0,232,237,0.03);
```

---

## Recharts Protocol (MANDATORY)
1. Every chart: own file + "use client"
2. Import via next/dynamic({ ssr: false })
3. Parent: explicit px height (h-[300px])
4. XAxis: explicit interval

---

## Motion
- Speed test sweep: CSS animation, ease-out, ~800ms
- Number counter: spring interpolation
- Card entrance: y: 8 → 0, opacity 0 → 1, 30ms stagger
- Scan-line: continuous, 2s linear infinite (during tests only)
- Pulsing dot: 2s ease-in-out infinite

---

## Navigation
Route-based (App Router). NOT tab-based.
- `/` — Dashboard overview
- `/speedtest` — Full speed test page
- `/history` — Past results
- `/traffic` — Traffic analyzer
