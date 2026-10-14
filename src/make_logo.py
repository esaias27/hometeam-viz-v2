"""Rebuild the HOME TEAM FM logo as a single-color SVG (text converted to paths)."""
import math, glob
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen

FONT = glob.glob('/home/claude/fonts/*oswald*/package/files/oswald-latin-600-normal.woff')[0]
font = TTFont(FONT)
gs = font.getGlyphSet()
cmap = font.getBestCmap()
upm = font['head'].unitsPerEm
cap = font['OS/2'].sCapHeight or 0.81 * upm


def text_items(s, tracking=0):
    """Return list of (recording, advance) in font units."""
    out = []
    for ch in s:
        g = cmap[ord(ch)]
        pen = RecordingPen()
        gs[g].draw(pen)
        out.append((pen.value, gs[g].width + tracking))
    return out


def text_path(s, x0, x1, top, bottom_fn, tracking=0):
    """Lay out string so it spans x0..x1; caps from `top` down to bottom_fn(x)."""
    items = text_items(s, tracking)
    total = sum(a for _, a in items) - tracking
    sx = (x1 - x0) / total
    d = []
    cx = 0.0

    def tf(px, py):
        X = x0 + (cx + px) * sx
        t = py / cap  # 0 at baseline, 1 at cap height
        bot = bottom_fn(X)
        Y = bot - t * (bot - top)
        return X, Y

    for rec, adv in items:
        for op, pts in rec:
            if op == 'moveTo':
                d.append('M%.1f %.1f' % tf(*pts[0]))
            elif op == 'lineTo':
                d.append('L%.1f %.1f' % tf(*pts[0]))
            elif op == 'qCurveTo':
                # expand implied on-curve points
                ps = list(pts)
                for i in range(len(ps) - 1):
                    c = ps[i]
                    if i < len(ps) - 2:
                        n = ((ps[i][0] + ps[i + 1][0]) / 2, (ps[i][1] + ps[i + 1][1]) / 2)
                    else:
                        n = ps[-1]
                    d.append('Q%.1f %.1f %.1f %.1f' % (*tf(*c), *tf(*n)))
            elif op == 'curveTo':
                a, b, c = pts
                d.append('C%.1f %.1f %.1f %.1f %.1f %.1f' % (*tf(*a), *tf(*b), *tf(*c)))
            elif op in ('closePath', 'endPath'):
                d.append('Z')
        cx += adv
    return ' '.join(d)


def bolt(cx, cy, ang, s=1.0):
    """Lightning bolt pointing along angle `ang` (degrees), tail at (cx,cy)."""
    pts = [(0, -11), (44, -19), (39, -5), (84, -7), (30, 17), (36, 4), (0, 10)]
    a = math.radians(ang)
    ca, sa = math.cos(a), math.sin(a)
    out = []
    for x, y in pts:
        x *= s; y *= s
        out.append((cx + x * ca - y * sa, cy + x * sa + y * ca))
    return 'M' + ' L'.join('%.1f %.1f' % p for p in out) + ' Z'


parts = []
# --- bolts around tower tip
TX, TY = 458, 150
for ang in (-145, -35, 145, 35):
    a = math.radians(ang)
    r0 = 40
    parts.append(('fill', bolt(TX + r0 * math.cos(a), TY + r0 * math.sin(a), ang, 1.12)))

# --- tower
top_y, base_y = 168, 572
def hw(y):
    t = (y - top_y) / (base_y - top_y)
    return 7 + 120 * t ** 1.9
legL = ' '.join(('M' if i == 0 else 'L') + '%.1f %.1f' % (TX - hw(y), y) for i, y in enumerate(range(top_y, base_y + 1, 6)))
legR = ' '.join(('M' if i == 0 else 'L') + '%.1f %.1f' % (TX + hw(y), y) for i, y in enumerate(range(top_y, base_y + 1, 6)))
parts.append(('stroke11', legL))
parts.append(('stroke11', legR))
parts.append(('stroke7', 'M%d %d L%d %d' % (TX, top_y, TX, base_y)))
levels = [215, 268, 330, 400, 478, 560]
braces = []
for y in levels:
    braces.append('M%.1f %d L%.1f %d' % (TX - hw(y), y, TX + hw(y), y))
for y0, y1 in zip(levels[:-1], levels[1:]):
    braces.append('M%.1f %d L%.1f %d' % (TX - hw(y0), y0, TX + hw(y1), y1))
    braces.append('M%.1f %d L%.1f %d' % (TX + hw(y0), y0, TX - hw(y1), y1))
y0 = top_y + 8
braces.append('M%.1f %d L%.1f %d' % (TX - hw(y0), y0, TX + hw(levels[0]), levels[0]))
braces.append('M%.1f %d L%.1f %d' % (TX + hw(y0), y0, TX - hw(levels[0]), levels[0]))
parts.append(('stroke5', ' '.join(braces)))
parts.append(('circle', (TX, TY, 15)))

# --- mound
parts.append(('fill', 'M150 670 C 255 512 660 512 765 670 Q 458 632 150 670 Z'))

# --- HOME TEAM (bridge warp: straight top, bottom arcs up toward center)
def bottom(x):
    xn = (x - 458) / 400
    return 806 + 40 * xn * xn
parts.append(('fill', text_path('HOME TEAM', 55, 862, 688, bottom, tracking=20)))

# --- FM
parts.append(('fill', text_path('FM', 437, 489, 832, lambda x: 872, tracking=30)))

# --- swooshes with zig bolts, mirrored
def swoosh(m):
    def P(x, y):
        return '%.1f %.1f' % (458 + m * (458 - x), y)
    blade1 = 'M' + P(90, 892) + ' Q' + P(220, 868) + ' ' + P(392, 862) + ' L' + P(388, 872) + ' Q' + P(230, 875) + ' ' + P(90, 892) + ' Z'
    blade2 = 'M' + P(120, 876) + ' Q' + P(220, 852) + ' ' + P(300, 848) + ' L' + P(296, 856) + ' Q' + P(220, 860) + ' ' + P(120, 876) + ' Z'
    zig = 'M' + P(300, 840) + ' L' + P(410, 840) + ' L' + P(345, 862) + ' L' + P(336, 856) + ' L' + P(372, 846) + ' L' + P(300, 846) + ' Z'
    zig2 = 'M' + P(250, 852) + ' L' + P(330, 852) + ' L' + P(282, 870) + ' L' + P(274, 865) + ' L' + P(300, 857) + ' L' + P(250, 858) + ' Z'
    return [blade1, blade2, zig, zig2]
for m in (1, -1):
    for d in swoosh(m):
        parts.append(('fill', d))

# --- website line
parts.append(('fill', text_path('HOMETEAM.FM', 362, 554, 920, lambda x: 942, tracking=25)))
parts.append(('fill', 'M150 930 L345 930 L345 933.5 L150 933.5 Z'))
parts.append(('fill', 'M571 930 L766 930 L766 933.5 L571 933.5 Z'))

svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="40 40 840 920" width="840" height="920">',
       '<g fill="#fff" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">']
for kind, d in parts:
    if kind == 'fill':
        svg.append('<path stroke="none" d="%s"/>' % d)
    elif kind.startswith('stroke'):
        w = kind[6:]
        svg.append('<path fill="none" stroke-width="%s" d="%s"/>' % (w, d))
    elif kind == 'circle':
        svg.append('<circle stroke="none" cx="%d" cy="%d" r="%d"/>' % d)
svg.append('</g></svg>')
open('/home/claude/build/logo.svg', 'w').write('\n'.join(svg))
print('ok', sum(len(s) for s in svg), 'bytes')
