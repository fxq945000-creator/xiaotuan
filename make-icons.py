# 生成 PWA 图标（纯标准库，手写 PNG）
import zlib, struct, os

def png(path, size, draw):
    px = [[(0, 0, 0, 0) for _ in range(size)] for _ in range(size)]
    draw(px, size)
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            raw.extend(px[y][x])
    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    out = b'\x89PNG\r\n\x1a\n'
    out += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    out += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    out += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(out)

def blend(dst, x, y, c, a=255):
    if x < 0 or y < 0 or x >= len(dst[0]) or y >= len(dst):
        return
    r, g, b, _ = dst[y][x]
    aa = a / 255.0
    dst[y][x] = (int(c[0] * aa + r * (1 - aa)), int(c[1] * aa + g * (1 - aa)), int(c[2] * aa + b * (1 - aa)), 255)

def disc(dst, cx, cy, r, c, a=255):
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            d2 = (x + .5 - cx) ** 2 + (y + .5 - cy) ** 2
            if d2 <= r * r:
                blend(dst, x, y, c, a)
            elif d2 <= (r + 1) ** 2:      # 边缘抗锯齿
                blend(dst, x, y, c, int(a * (1 - (d2 - r * r) / (2 * r + 1))))

def ellip(dst, cx, cy, rx, ry, c, a=255):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            v = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
            if v <= 1:
                blend(dst, x, y, c, a)

BG = (255, 154, 92)        # 背景橙
BG2 = (255, 190, 140)      # 背景浅橙（上浅下深）
FUR = (255, 241, 226)      # 毛色米白
INNER = (255, 201, 168)    # 内耳
INK = (74, 59, 54)         # 眼睛
BLUSH = (255, 158, 182)    # 腮红
LINE = (74, 59, 54)        # 嘴线

def make(scale):
    def draw(px, size):
        S = size
        # 背景：竖向渐变
        for y in range(S):
            t = y / (S - 1)
            c = (int(BG[0] * (1 - t) + BG2[0] * t), int(BG[1] * (1 - t) + BG2[1] * t), int(BG[2] * (1 - t) + BG2[2] * t))
            for x in range(S):
                px[y][x] = (c[0], c[1], c[2], 255)
        k = S / 512.0 * scale        # scale<1 时整体缩小（maskable 安全区）
        cx, cy = S / 2, S / 2 + 12 * (S / 512.0)
        def R(v): return v * (S / 512.0) * scale
        # 耳朵
        for ex in (-1, 1):
            disc(px, cx + R(112) * ex, cy - R(118), R(58), FUR)
            disc(px, cx + R(112) * ex, cy - R(112), R(32), INNER)
        # 脸
        disc(px, cx, cy, R(155), FUR)
        disc(px, cx, cy + R(66), R(120), FUR)      # 下半脸更饱满
        # 眼睛
        for ex in (-1, 1):
            ellip(px, cx + R(52) * ex, cy - R(12), R(17), R(24), INK)
            disc(px, cx + R(58) * ex, cy - R(22), R(6), (255, 255, 255))
        # 腮红
        for ex in (-1, 1):
            disc(px, cx + R(84) * ex, cy + R(38), R(24), BLUSH, 200)
        # 嘴（小 w）
        for i in range(int(R(70))):
            t = i / R(70) - .5
            yy = cy + R(30) + (.35 - t * t * 4) * R(20)
            for w in range(-1, 2):
                disc(px, cx + t * R(76) + w, yy, R(4.2), LINE)
        # 呆毛
        disc(px, cx + R(6), cy - R(168), R(14), FUR)
        disc(px, cx + R(20), cy - R(182), R(9), FUR)
    return draw

os.chdir(os.path.dirname(os.path.abspath(__file__)))
png('icon-192.png', 192, make(1.0))
png('icon-512.png', 512, make(1.0))
png('icon-maskable-512.png', 512, make(0.72))   # 可遮罩：缩小留安全边
print('icons written')
