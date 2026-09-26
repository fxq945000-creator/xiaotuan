/* ============================================================
 *  小团 · 形象渲染引擎
 *  全部角色图形均为程序化 SVG：可换毛色 / 发型 / 发色 / 服装 / 配饰
 *  表情由状态推导（困、饿、病、开心、难过、发呆…）
 * ============================================================ */

const FUR_COLORS = [
  { id: 'cream', name: '奶油', c: '#FFE3C8', s: '#F6CFA6' },
  { id: 'peach', name: '蜜桃', c: '#FFCFC4', s: '#F4B2A4' },
  { id: 'mint',  name: '薄荷', c: '#CFEBD9', s: '#AFDCC5' },
  { id: 'sky',   name: '天空', c: '#D5E6F8', s: '#B2CDEA' },
  { id: 'lilac', name: '丁香', c: '#E5DBF6', s: '#C8B8E7' },
];

const HAIR_COLORS = [
  { id: 'black', name: '墨黑', c: '#3B2B24' },
  { id: 'brown', name: '栗棕', c: '#8B5E3C' },
  { id: 'gold',  name: '蜜金', c: '#E8B45A' },
  { id: 'pink',  name: '樱粉', c: '#F49AC1' },
  { id: 'blue',  name: '雾霾蓝', c: '#6C93D6' },
  { id: 'green', name: '抹茶绿', c: '#6FBF87' },
  { id: 'purple',name: '薰衣紫', c: '#A57BD1' },
  { id: 'red',   name: '枫叶红', c: '#D9534F' },
  { id: 'gray',  name: '奶奶灰', c: '#C9CDD3' },
];

/* 发型：back 画在头后，cap 画在头顶，acc 是发饰 */
const HAIR_STYLES = {
  bald: {
    name: '小光头', price: 0,
    back: '', cap: '',
  },
  short: {
    name: '清爽短发', price: 0,
    back: '<path d="M62,78 C60,46 84,32 110,32 C136,32 160,46 158,78 C148,58 132,62 110,60 C88,62 72,58 62,78 Z" fill="HAIR"/>',
    cap: '<path d="M64,74 C68,50 88,40 110,40 C132,40 152,50 156,74 C144,60 128,64 110,62 C92,64 76,60 64,74 Z" fill="HAIR" opacity=".96"/>',
  },
  bowl: {
    name: '锅盖头', price: 30,
    back: '<path d="M60,86 C58,48 84,30 110,30 C136,30 162,48 160,86 C150,62 132,66 110,64 C88,66 70,62 60,86 Z" fill="HAIR"/>',
    cap: '<path d="M62,72 C62,42 86,30 110,30 C134,30 158,42 158,72 C146,58 128,62 110,62 C92,62 74,58 62,72 Z" fill="HAIR"/><path d="M63,70 C88,80 132,80 157,70" stroke="HAIR" stroke-width="3" fill="none"/>',
  },
  bangs: {
    name: '齐刘海', price: 40,
    back: '<path d="M58,90 C54,50 82,30 110,30 C138,30 166,50 162,90 C152,66 134,70 110,68 C86,70 68,66 58,90 Z" fill="HAIR"/>',
    cap: '<path d="M62,70 C62,40 86,30 110,30 C134,30 158,40 158,70 L152,68 C136,76 84,76 68,68 Z" fill="HAIR"/>',
  },
  long: {
    name: '长直发', price: 60,
    back: '<path d="M56,66 C44,104 44,166 52,202 C66,196 68,146 72,104 Z" fill="HAIR"/><path d="M164,66 C176,104 176,166 168,202 C154,196 152,146 148,104 Z" fill="HAIR"/><path d="M58,60 C58,40 84,28 110,28 C136,28 162,40 162,60 C150,44 130,40 110,40 C90,40 70,44 58,60 Z" fill="HAIR"/>',
    cap: '<path d="M64,70 C66,48 88,40 110,40 C132,40 154,48 156,70 C144,58 128,62 110,60 C92,62 76,58 64,70 Z" fill="HAIR"/>',
  },
  twin: {
    name: '双马尾', price: 80,
    back: '<path d="M64,62 C42,70 30,104 34,138 C46,132 54,104 62,84 Z" fill="HAIR"/><path d="M156,62 C178,70 190,104 186,138 C174,132 166,104 154,84 Z" fill="HAIR"/><path d="M62,74 C60,46 84,32 110,32 C136,32 160,46 158,74 C148,56 132,60 110,58 C88,60 72,56 62,74 Z" fill="HAIR"/>',
    cap: '<path d="M64,70 C66,48 88,40 110,40 C132,40 154,48 156,70 C144,58 128,62 110,60 C92,62 76,58 64,70 Z" fill="HAIR"/><circle cx="66" cy="58" r="7" fill="#FF9EB6"/><circle cx="154" cy="58" r="7" fill="#FF9EB6"/>',
  },
  bun: {
    name: '丸子头', price: 70,
    back: '<circle cx="110" cy="26" r="19" fill="HAIR"/><path d="M64,74 C62,50 86,36 110,36 C134,36 158,50 156,74 C146,58 130,62 110,60 C90,62 74,58 64,74 Z" fill="HAIR"/>',
    cap: '<path d="M66,68 C68,50 88,42 110,42 C132,42 152,50 154,68 C142,58 128,62 110,60 C92,62 78,58 66,68 Z" fill="HAIR"/>',
  },
  ponytail: {
    name: '高马尾', price: 55,
    back: '<path d="M108,32 C132,20 154,34 156,64 C154,92 142,116 138,132 C132,110 122,76 118,52 Z" fill="HAIR"/><path d="M62,76 C60,48 84,34 110,34 C136,34 160,48 158,76 C148,58 132,62 110,60 C88,62 72,58 62,76 Z" fill="HAIR"/>',
    cap: '<path d="M66,68 C68,50 88,42 110,42 C132,42 152,50 154,68 C142,58 128,62 110,60 C92,62 78,58 66,68 Z" fill="HAIR"/><circle cx="112" cy="36" r="8" fill="#FF9EB6"/>',
  },
  curly: {
    name: '羊毛卷', price: 90,
    back: '<circle cx="58" cy="86" r="17" fill="HAIR"/><circle cx="50" cy="110" r="16" fill="HAIR"/><circle cx="54" cy="134" r="15" fill="HAIR"/><circle cx="162" cy="86" r="17" fill="HAIR"/><circle cx="170" cy="110" r="16" fill="HAIR"/><circle cx="166" cy="134" r="15" fill="HAIR"/><circle cx="110" cy="40" r="30" fill="HAIR"/>',
    cap: '<circle cx="78" cy="58" r="14" fill="HAIR"/><circle cx="100" cy="48" r="15" fill="HAIR"/><circle cx="122" cy="48" r="15" fill="HAIR"/><circle cx="144" cy="58" r="14" fill="HAIR"/>',
  },
  spiky: {
    name: '刺猬头', price: 50,
    back: '',
    cap: '<path d="M60,72 L66,46 L76,64 L88,36 L98,60 L110,32 L122,60 L134,36 L146,64 L156,46 L162,72 C150,58 132,62 110,60 C88,62 72,58 60,72 Z" fill="HAIR"/>',
  },
  afro: {
    name: '爆炸头', price: 100,
    back: '<circle cx="66" cy="62" r="26" fill="HAIR"/><circle cx="154" cy="62" r="26" fill="HAIR"/><circle cx="110" cy="34" r="30" fill="HAIR"/><circle cx="84" cy="44" r="22" fill="HAIR"/><circle cx="136" cy="44" r="22" fill="HAIR"/>',
    cap: '<circle cx="80" cy="66" r="14" fill="HAIR"/><circle cx="140" cy="66" r="14" fill="HAIR"/><circle cx="110" cy="58" r="16" fill="HAIR"/>',
  },
};

/* 服装：body 主色，extra 覆盖在身体上（领子/扣子/口袋…），warm 保暖等级 0-3，rain 防雨 */
const OUTFITS = {
  home: {
    name: '云朵家居服', price: 0, body: '#FFC9A0', warm: 1, rain: false, level: 0,
    extra: '<path d="M92,126 h36 v14 h-36 z" fill="#FFF1E2" opacity=".9"/><circle cx="110" cy="152" r="3" fill="#E8A87C"/><circle cx="110" cy="166" r="3" fill="#E8A87C"/>',
  },
  pajama: {
    name: '星星睡衣', price: 40, body: '#BFD8F2', warm: 2, rain: false, level: 0,
    extra: '<path d="M92,124 h36 v16 h-36 z" fill="#EAF3FF"/><path d="M74,150 h72" stroke="#9CC0E8" stroke-width="4"/><path d="M74,166 h72" stroke="#9CC0E8" stroke-width="4"/><path d="M110,182 l3,6 7,1 -5,5 1,7 -6,-4 -6,4 1,-7 -5,-5 7,-1 z" fill="#FFD98A"/>',
  },
  school: {
    name: '学院校服', price: 60, body: '#F2F5FA', warm: 1, rain: false, level: 1,
    extra: '<path d="M92,124 l18,16 18,-16 -18,-6 z" fill="#3D5A9E"/><path d="M110,140 l-6,22 6,6 6,-6 -6,-22 z" fill="#D9534F"/><path d="M76,150 h68" stroke="#DCE3EE" stroke-width="3"/>',
  },
  sport: {
    name: '元气运动服', price: 70, body: '#7FC8A9', warm: 1, rain: false, level: 1,
    extra: '<path d="M88,124 h44 v12 h-44 z" fill="#FFFFFF" opacity=".85"/><path d="M68,148 h84" stroke="#FFFFFF" stroke-width="5" opacity=".7"/><path d="M68,162 h84" stroke="#FFFFFF" stroke-width="5" opacity=".7"/>',
  },
  winter: {
    name: '面包羽绒服', price: 120, body: '#E8705F', warm: 3, rain: false, level: 2,
    extra: '<path d="M92,122 h36 v18 h-36 z" fill="#FFE0D2"/><path d="M68,146 h84" stroke="#C9523F" stroke-width="3"/><path d="M68,160 h84" stroke="#C9523F" stroke-width="3"/><path d="M68,174 h84" stroke="#C9523F" stroke-width="3"/><path d="M70,126 c-10,10 -10,26 0,36" stroke="#FFE0D2" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M150,126 c10,10 10,26 0,36" stroke="#FFE0D2" stroke-width="9" fill="none" stroke-linecap="round"/>',
  },
  raincoat: {
    name: '小黄鸭雨衣', price: 90, body: '#FFD45E', warm: 1, rain: true, level: 1,
    extra: '<path d="M92,124 h36 v16 h-36 z" fill="#FFE9A8"/><path d="M66,178 c8,-14 16,-14 22,0 6,-14 14,-14 22,0 6,-14 14,-14 22,0 z" fill="#FFC93C"/><circle cx="110" cy="158" r="5" fill="#FFF3C4"/>',
  },
  dress: {
    name: '公主纱裙', price: 140, body: '#FFB3C6', warm: 1, rain: false, level: 2,
    extra: '<path d="M92,124 h36 v14 h-36 z" fill="#FFE1EA"/><path d="M66,176 c10,-18 22,-18 44,-18 22,0 34,0 44,18 z" fill="#FFC9D9"/><circle cx="110" cy="150" r="4" fill="#FFF"/><path d="M70,132 l-8,-8" stroke="#FF9EB6" stroke-width="4" stroke-linecap="round"/>',
  },
  formal: {
    name: '小小西装', price: 160, body: '#4A5568', warm: 1, rain: false, level: 3,
    extra: '<path d="M92,124 l18,18 18,-18 -18,-8 z" fill="#FFFFFF"/><path d="M110,142 l-5,20 5,8 5,-8 -5,-20 z" fill="#2D3748"/><circle cx="110" cy="172" r="3" fill="#FFD98A"/>',
  },
  doctor: {
    name: '白大褂', price: 130, body: '#FFFFFF', warm: 1, rain: false, level: 2,
    extra: '<path d="M92,124 h36 v16 h-36 z" fill="#EAF3FF"/><path d="M76,152 h26 v20 h-26 z" fill="#DCEAF8" stroke="#B9D2EA" stroke-width="2"/><path d="M89,152 v20 M76,162 h26" stroke="#5B9BD5" stroke-width="3"/>',
  },
  space: {
    name: '宇航服', price: 220, body: '#E8ECF3', warm: 3, rain: true, level: 4,
    extra: '<path d="M92,126 h36 v14 h-36 z" fill="#B9C4D6"/><circle cx="96" cy="152" r="6" fill="#7FC8A9"/><circle cx="110" cy="152" r="6" fill="#FFD45E"/><circle cx="124" cy="152" r="6" fill="#E8705F"/><path d="M68,146 h84" stroke="#C6CEDA" stroke-width="4"/>',
  },
};

const HATS = {
  none:    { name: '不戴', price: 0, svg: '' },
  beanie:  { name: '毛线帽', price: 50, warm: 2, svg: '<path d="M64,58 C64,26 92,12 110,12 C128,12 156,26 156,58 Z" fill="#E8705F"/><rect x="62" y="54" width="96" height="14" rx="7" fill="#FFF1E2"/><circle cx="110" cy="10" r="8" fill="#FFF1E2"/>' },
  cap:     { name: '鸭舌帽', price: 45, warm: 0, svg: '<path d="M64,56 C64,28 90,16 110,16 C130,16 156,28 156,56 Z" fill="#6C93D6"/><path d="M100,56 h72 a8,8 0 0 1 0,14 h-72 z" fill="#4E74B5"/>' },
  straw:   { name: '草帽', price: 60, warm: 1, svg: '<ellipse cx="110" cy="58" rx="62" ry="14" fill="#E8C46A"/><path d="M78,58 C78,28 96,18 110,18 C124,18 142,28 142,58 Z" fill="#F2D68A"/><path d="M80,48 h60" stroke="#C99B44" stroke-width="4"/>' },
  crown:   { name: '小皇冠', price: 200, warm: 0, svg: '<path d="M74,44 L84,18 L98,34 L110,12 L122,34 L136,18 L146,44 Z" fill="#FFD45E" stroke="#E8B93C" stroke-width="2"/><rect x="74" y="44" width="72" height="8" rx="4" fill="#FFE28A"/>' },
};

const GLASSES = {
  none:   { name: '不戴', price: 0, svg: '' },
  round:  { name: '圆框眼镜', price: 55, svg: '<g fill="none" stroke="#4A3B36" stroke-width="3"><circle cx="92" cy="88" r="13"/><circle cx="128" cy="88" r="13"/><path d="M105,88 h6"/><path d="M79,86 l-12,-4"/><path d="M141,86 l12,-4"/></g>' },
  sun:    { name: '太阳镜', price: 80, svg: '<g><rect x="76" y="78" width="32" height="18" rx="8" fill="#3B2B24"/><rect x="112" y="78" width="32" height="18" rx="8" fill="#3B2B24"/><path d="M108,86 h4" stroke="#3B2B24" stroke-width="3"/><path d="M80,84 l-10,-4 M140,84 l10,-4" stroke="#3B2B24" stroke-width="3"/></g>' },
  heart:  { name: '爱心眼镜', price: 90, svg: '<g fill="#FF9EB6" stroke="#E8705F" stroke-width="2"><path d="M92,100 c-12,-8 -16,-18 -6,-20 8,-2 12,6 12,6 0,-8 4,-14 12,-6 10,10 -6,22 -18,20 z"/><path d="M128,100 c-12,-8 -16,-18 -6,-20 8,-2 12,6 12,6 0,-8 4,-14 12,-6 10,10 -6,22 -18,20 z"/><path d="M104,88 h8" stroke="#E8705F" stroke-width="3" fill="none"/></g>' },
};

/* 场景背景 */
const SCENES = {
  home: {
    day: '<rect width="220" height="250" fill="url(#gHome)"/><rect x="18" y="28" width="74" height="66" rx="8" fill="#FFF8EE" stroke="#E8D9C8" stroke-width="3"/><path d="M55,28 v66 M18,61 h74" stroke="#E8D9C8" stroke-width="3"/><circle cx="86" cy="46" r="9" fill="#FFE7A8"/><path d="M120,94 h84" stroke="#E8D9C8" stroke-width="3"/><rect x="130" y="70" width="60" height="24" rx="4" fill="#FFE1C8"/><ellipse cx="110" cy="230" rx="80" ry="12" fill="#EFE0D0" opacity=".7"/>',
    night: '<rect width="220" height="250" fill="url(#gNight)"/><circle cx="180" cy="40" r="16" fill="#FFF3C4"/><rect x="18" y="28" width="74" height="66" rx="8" fill="#3C4A66" stroke="#5A6B8C" stroke-width="3"/><path d="M55,28 v66 M18,61 h74" stroke="#5A6B8C" stroke-width="3"/><ellipse cx="110" cy="230" rx="80" ry="12" fill="#2E3A55" opacity=".8"/>',
  },
  school: '<rect width="220" height="250" fill="url(#gSchool)"/><rect x="30" y="70" width="160" height="110" rx="6" fill="#FFF6E8" stroke="#E0CBAE" stroke-width="3"/><path d="M30,96 h160" stroke="#E0CBAE" stroke-width="3"/><g fill="#9CC7E8"><rect x="44" y="108" width="26" height="24" rx="3"/><rect x="84" y="108" width="26" height="24" rx="3"/><rect x="124" y="108" width="26" height="24" rx="3"/><rect x="44" y="146" width="26" height="24" rx="3"/><rect x="84" y="146" width="26" height="24" rx="3"/><rect x="124" y="146" width="26" height="24" rx="3"/></g><path d="M92,70 l18,-24 18,24 z" fill="#E8705F"/><rect x="106" y="20" width="4" height="26" fill="#4A3B36"/><ellipse cx="110" cy="230" rx="80" ry="12" fill="#E4D6C0"/>',
  park: '<rect width="220" height="250" fill="url(#gPark)"/><circle cx="40" cy="40" r="18" fill="#FFF0B8"/><path d="M0,196 h220 v54 H0 z" fill="#A8DCA0"/><g><rect x="150" y="120" width="10" height="78" rx="4" fill="#B9835A"/><circle cx="155" cy="106" r="30" fill="#7FC8A9"/><circle cx="130" cy="116" r="20" fill="#6FBF87"/><circle cx="180" cy="118" r="20" fill="#6FBF87"/></g><g><rect x="34" y="150" width="8" height="46" rx="4" fill="#B9835A"/><circle cx="38" cy="140" r="20" fill="#9BD8B4"/></g><ellipse cx="110" cy="230" rx="80" ry="12" fill="#8FCB88"/>',
  salon: '<rect width="220" height="250" fill="url(#gSalon)"/><rect x="20" y="40" width="180" height="10" rx="5" fill="#D9C3E8"/><g fill="#E8705F"><circle cx="40" cy="60" r="8"/><circle cx="64" cy="60" r="8"/><circle cx="88" cy="60" r="8"/></g><rect x="150" y="90" width="56" height="70" rx="6" fill="#FFF" stroke="#E0D4EE" stroke-width="3"/><rect x="158" y="104" width="40" height="42" rx="4" fill="#EFE6F8"/><ellipse cx="110" cy="230" rx="80" ry="12" fill="#E6DDF2"/>',
  clinic: '<rect width="220" height="250" fill="url(#gClinic)"/><rect x="150" y="60" width="60" height="24" rx="4" fill="#FFF" stroke="#CFE4F2" stroke-width="3"/><path d="M170,72 h20 M180,62 v20" stroke="#E8705F" stroke-width="6" stroke-linecap="round"/><rect x="24" y="120" width="50" height="36" rx="5" fill="#FFF" stroke="#CFE4F2" stroke-width="3"/><path d="M36,138 h26 M49,125 v26" stroke="#7FC8A9" stroke-width="5" stroke-linecap="round"/><ellipse cx="110" cy="230" rx="80" ry="12" fill="#DCE9F2"/>',
};

/* 图标（线性 SVG，24x24） */
const ICON = {
  feed: '<path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M3 20h18"/><path d="M9 7c0-1.5 1-2 1-3"/>',
  bath: '<path d="M3 11h18v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z"/><path d="M7 11V6a2 2 0 0 1 4 0"/><circle cx="16" cy="4" r="1"/><circle cx="19" cy="7" r="1"/>',
  sleep: '<path d="M3 18v-6a2 2 0 0 1 2-2h11a3 3 0 0 1 3 3v5"/><path d="M3 18h18"/><path d="M7 10V7h10v3"/><path d="M20 8l2 2-2 2"/>',
  school: '<path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M10 21v-6h4v6"/><path d="M12 4v3"/>',
  closet: '<path d="M8 4l4 3 4-3 5 3-2 4-2-1.5V21H7V9.5L5 11 3 7z"/>',
  scissors: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M20 4L8.5 15.5"/><path d="M20 20L8.5 8.5"/>',
  pill: '<circle cx="8" cy="8" r="5"/><path d="M11.5 11.5L20 20"/><path d="M14 14l6-6"/>',
  walk: '<circle cx="13" cy="4" r="2.5"/><path d="M11 21l2-7-3-3 1-5 4 3 3 1"/><path d="M9 21l3-5 3 5"/>',
  game: '<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3"/><circle cx="16" cy="11.5" r="1.2"/><circle cx="18.5" cy="14" r="1.2"/>',
  diary: '<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z"/><path d="M8 8h8M8 12h8M8 16h5"/><path d="M18 3v18"/>',
  heart: '<path d="M12 20s-7-4.5-7-9.5A4 4 0 0 1 12 7a4 4 0 0 1 7 3.5C19 15.5 12 20 12 20z"/>',
  coin: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10h5M9.5 14h5"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 2A3.5 3.5 0 0 0 7 18z"/>',
  rain: '<path d="M7 15h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 2A3.5 3.5 0 0 0 7 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
  snow: '<path d="M7 14h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 2A3.5 3.5 0 0 0 7 14z"/><path d="M9 19v2M15 19v2M12 17v4"/>',
  bolt: '<path d="M13 2L5 14h5l-1 8 8-12h-5z"/>',
  book: '<path d="M3 6a2 2 0 0 1 2-2h6v16H5a2 2 0 0 1-2-2z"/><path d="M21 6a2 2 0 0 0-2-2h-6v16h6a2 2 0 0 0 2-2z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
  home: '<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M10 21v-6h4v6"/>',
  star: '<path d="M12 3l2.6 6.2 6.7.5-5.1 4.4 1.6 6.6L12 17.4 6.2 20.7l1.6-6.6L2.7 9.7l6.7-.5z"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  bus: '<rect x="4" y="4" width="16" height="12" rx="3"/><path d="M4 11h16"/><circle cx="8" cy="19" r="1.6"/><circle cx="16" cy="19" r="1.6"/><path d="M8 16v1M16 16v1"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c0-3.7 3.4-5.7 7.5-5.7s7.5 2 7.5 5.7"/>',
  bell: '<path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.6 1.5 5.6h-15S6 13 6 9z"/><path d="M10 18.2a2 2 0 0 0 4 0"/>',
  gift: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M3 12h18M12 8v13"/><path d="M12 8S9 3.6 7 4.6s1 3.4 5 3.4zM12 8s3-4.4 5-3.4-1 3.4-5 3.4z"/>',
  wallet: '<path d="M3 7h15a3 3 0 0 1 3 3v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7V6a2 2 0 0 1 2-2h12"/><circle cx="16.5" cy="14" r="1.3"/>',
  crown: '<path d="M3 18l2.2-9 3.8 3 3-6.4 3 6.4 3.8-3 2.2 9z"/><path d="M5 20.5h14"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.6M12 18.4V21M3 12h2.6M18.4 12H21M5.6 5.6l1.9 1.9M16.5 16.5l1.9 1.9M18.4 5.6l-1.9 1.9M7.5 16.5l-1.9 1.9"/>',
  shield: '<path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  medal: '<circle cx="12" cy="14.5" r="5.5"/><path d="M9 9L6 2.5h12L15 9"/><path d="M12 12.5l.9 1.9 2.1.3-1.5 1.5.4 2-1.9-1-1.9 1 .4-2L9.5 14.7l2.1-.3z"/>',
};

function icon(name, size, cls) {
  const d = ICON[name] || '';
  return `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" width="${size || 22}" height="${size || 22}"
    fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
}

/* ---------------- 表情零件 ---------------- */
function eyes(kind) {
  const ink = '#4A3B36';
  const L = 92, R = 128, Y = 88;
  switch (kind) {
    case 'happy':
      return `<g stroke="${ink}" stroke-width="4" fill="none" stroke-linecap="round">
        <path d="M${L - 9},${Y + 3} Q${L},${Y - 8} ${L + 9},${Y + 3}"/>
        <path d="M${R - 9},${Y + 3} Q${R},${Y - 8} ${R + 9},${Y + 3}"/></g>`;
    case 'sleep':
      return `<g stroke="${ink}" stroke-width="4" fill="none" stroke-linecap="round">
        <path d="M${L - 9},${Y - 2} Q${L},${Y + 6} ${L + 9},${Y - 2}"/>
        <path d="M${R - 9},${Y - 2} Q${R},${Y + 6} ${R + 9},${Y - 2}"/></g>`;
    case 'sick':
      return `<g stroke="${ink}" stroke-width="4" fill="none" stroke-linecap="round">
        <path d="M${L - 8},${Y - 7} l16,14 M${L + 8},${Y - 7} l-16,14"/>
        <path d="M${R - 8},${Y - 7} l16,14 M${R + 8},${Y - 7} l-16,14"/></g>`;
    case 'dizzy':
      return `<g stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round">
        <path d="M${L},${Y - 8} a8,8 0 1 1 -6,6 a5,5 0 1 0 8,-1"/>
        <path d="M${R},${Y - 8} a8,8 0 1 1 -6,6 a5,5 0 1 0 8,-1"/></g>`;
    case 'sad':
      return `<g fill="${ink}"><ellipse cx="${L}" cy="${Y}" rx="7" ry="9"/><ellipse cx="${R}" cy="${Y}" rx="7" ry="9"/></g>
        <g fill="#FFF"><circle cx="${L + 3}" cy="${Y - 3}" r="2.6"/><circle cx="${R + 3}" cy="${Y - 3}" r="2.6"/></g>
        <path d="M${L - 12},${Y - 12} l14,5" stroke="${ink}" stroke-width="3.4" stroke-linecap="round"/>
        <path d="M${R + 12},${Y - 12} l-14,5" stroke="${ink}" stroke-width="3.4" stroke-linecap="round"/>
        <path d="M${L - 6},${Y + 12} q5,10 11,2" stroke="#7EC8E3" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    case 'star':
      return `<g fill="#FFC93C"><path d="M${L},${Y - 10} l2.6,6 6.6,.5 -5,4.3 1.5,6.5 -5.7,-3.4 -5.7,3.4 1.5,-6.5 -5,-4.3 6.6,-.5 z"/>
        <path d="M${R},${Y - 10} l2.6,6 6.6,.5 -5,4.3 1.5,6.5 -5.7,-3.4 -5.7,3.4 1.5,-6.5 -5,-4.3 6.6,-.5 z"/></g>`;
    case 'angry':
      return `<g fill="${ink}"><ellipse cx="${L}" cy="${Y}" rx="7" ry="9"/><ellipse cx="${R}" cy="${Y}" rx="7" ry="9"/></g>
        <g fill="#FFF"><circle cx="${L + 3}" cy="${Y - 3}" r="2.6"/><circle cx="${R + 3}" cy="${Y - 3}" r="2.6"/></g>
        <path d="M${L - 12},${Y - 10} l15,8" stroke="${ink}" stroke-width="3.6" stroke-linecap="round"/>
        <path d="M${R + 12},${Y - 10} l-15,8" stroke="${ink}" stroke-width="3.6" stroke-linecap="round"/>`;
    default: /* open */
      return `<g class="blink"><g fill="${ink}"><ellipse cx="${L}" cy="${Y}" rx="7.5" ry="9.5"/><ellipse cx="${R}" cy="${Y}" rx="7.5" ry="9.5"/></g>
        <g fill="#FFF"><circle cx="${L + 3}" cy="${Y - 3}" r="2.8"/><circle cx="${R + 3}" cy="${Y - 3}" r="2.8"/></g></g>`;
  }
}

function mouth(kind) {
  const ink = '#4A3B36';
  switch (kind) {
    case 'big':
      return `<path d="M96,108 Q110,128 124,108 Q110,116 96,108 Z" fill="${ink}"/><path d="M102,118 q8,6 16,0 q-8,8 -16,0 z" fill="#FF8FA0"/>`;
    case 'frown':
      return `<path d="M98,120 Q110,110 122,120" stroke="${ink}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`;
    case 'flat':
      return `<path d="M100,116 h20" stroke="${ink}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
    case 'o':
      return `<ellipse cx="110" cy="116" rx="7" ry="9" fill="${ink}"/>`;
    case 'wave':
      return `<path d="M96,116 q5,-5 9,0 t9,0 t9,0" stroke="${ink}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
    case 'zzz':
      return `<ellipse cx="110" cy="115" rx="6" ry="4" fill="${ink}" opacity=".7"/>`;
    default: /* smile */
      return `<path d="M98,110 Q110,122 122,110" stroke="${ink}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`;
  }
}

/* ---------------- 主渲染 ----------------
 * pet: { fur, hair, hairColor, hairLen, outfit, hat, glasses, scarf }
 * expr: { eyes, mouth, mood:'idle|sleep|sick|happy|sad', blush, fx:[...] }
 */
function renderPet(pet, expr) {
  const fur = FUR_COLORS.find(f => f.id === pet.fur) || FUR_COLORS[0];
  const hs = HAIR_STYLES[pet.hair] || HAIR_STYLES.short;
  const hc = (HAIR_COLORS.find(h => h.id === pet.hairColor) || HAIR_COLORS[0]).c;
  const of = OUTFITS[pet.outfit] || OUTFITS.home;
  const hat = HATS[pet.hat] || HATS.none;
  const gl = GLASSES[pet.glasses] || GLASSES.none;

  const back = (hs.back || '').replace(/HAIR/g, hc);
  const cap = (hs.cap || '').replace(/HAIR/g, hc);
  // 头发太长 → 蓬乱加成
  const messy = pet.hairLen > 65;
  const messySvg = messy
    ? `<path d="M70,44 l-8,-10 M110,32 l0,-12 M150,44 l8,-10" stroke="${hc}" stroke-width="4" fill="none" stroke-linecap="round"/>`
    : '';

  const fx = (expr.fx || []).map(f => {
    if (f === 'zzz') return `<g class="fx-zzz" fill="#7E8CA8" font-size="20" font-weight="700"><text x="158" y="52">z</text><text x="170" y="36" font-size="15">z</text><text x="180" y="24" font-size="11">z</text></g>`;
    if (f === 'sweat') return `<path class="fx-drop" d="M156,74 q8,10 0,14 q-8,-4 0,-14 z" fill="#7EC8E3"/>`;
    if (f === 'fever') return `<g class="fx-fever" transform="translate(60,44)"><circle r="11" fill="#FF8A80"/><path d="M-5,0 h10 M0,-5 v10" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/></g>`;
    if (f === 'heart') return `<g class="fx-heart"><path d="M164,64 c-6,-4 -8,-9 -3,-11 4,-2 7,3 7,3 0,-4 3,-8 7,-3 5,4 -3,13 -11,11 z" fill="#FF8FA0"/></g>`;
    if (f === 'note') return `<g class="fx-note" fill="#9B8BD6"><text x="160" y="60" font-size="18">♪</text><text x="176" y="46" font-size="13">♫</text></g>`;
    if (f === 'food') return `<g class="fx-note"><path d="M150,70 a10,10 0 0 1 20,0 z" fill="#FFC93C"/><rect x="148" y="68" width="24" height="4" rx="2" fill="#FFE28A"/></g>`;
    return '';
  }).join('');

  const blush = expr.blush
    ? `<g fill="#FF9AA2" opacity=".55"><ellipse cx="76" cy="104" rx="10" ry="5.5"/><ellipse cx="144" cy="104" rx="10" ry="5.5"/></g>`
    : '';

  const scarf = pet.scarf
    ? `<path d="M78,132 q32,14 64,0 v12 q-32,14 -64,0 z" fill="#E8705F"/><path d="M78,144 l-8,26" stroke="#E8705F" stroke-width="12" stroke-linecap="round"/>`
    : '';

  const tint = expr.mood === 'sick'
    ? `<ellipse cx="110" cy="88" rx="52" ry="52" fill="#8FD9A8" opacity=".16"/>`
    : '';

  return `
<svg viewBox="0 0 220 250" class="pet-svg ${'m-' + (expr.mood || 'idle')}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="gBody" cx=".4" cy=".3" r=".9">
      <stop offset="0" stop-color="${fur.c}"/><stop offset="1" stop-color="${fur.s}"/>
    </radialGradient>
  </defs>
  <g class="pet-body">
    <ellipse cx="110" cy="228" rx="56" ry="10" fill="#000" opacity=".08"/>
    ${back}
    <g>
      <ellipse cx="74" cy="46" rx="13" ry="18" fill="${fur.s}" transform="rotate(-22 74 46)"/>
      <ellipse cx="146" cy="46" rx="13" ry="18" fill="${fur.s}" transform="rotate(22 146 46)"/>
      <ellipse cx="74" cy="48" rx="6" ry="9" fill="#FFB3C6" opacity=".7" transform="rotate(-22 74 48)"/>
      <ellipse cx="146" cy="48" rx="6" ry="9" fill="#FFB3C6" opacity=".7" transform="rotate(22 146 48)"/>
    </g>
    <g fill="${fur.s}">
      <rect x="88" y="192" width="17" height="28" rx="8.5"/>
      <rect x="115" y="192" width="17" height="28" rx="8.5"/>
    </g>
    <rect x="66" y="122" width="88" height="80" rx="34" fill="${of.body}"/>
    ${of.extra}
    <g fill="${fur.s}">
      <rect x="56" y="138" width="19" height="46" rx="9.5" transform="rotate(-9 65 145)"/>
      <rect x="145" y="138" width="19" height="46" rx="9.5" transform="rotate(9 155 145)"/>
    </g>
    <circle cx="110" cy="86" r="50" fill="url(#gBody)"/>
    ${tint}
    ${cap}${messySvg}
    ${eyes(expr.eyes)}
    ${mouth(expr.mouth)}
    ${blush}
    ${gl.svg}
    ${hat.svg}
    ${scarf}
    ${fx}
  </g>
</svg>`;
}

/* 场景 SVG（含天气贴纸） */
function renderScene(key, weather, night) {
  let svg = '';
  if (key === 'home') svg = night ? SCENES.home.night : SCENES.home.day;
  else svg = SCENES[key] || SCENES.home.day;

  const defs = `<defs>
    <linearGradient id="gHome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF3E4"/><stop offset="1" stop-color="#FFE6CF"/></linearGradient>
    <linearGradient id="gNight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#40506F"/><stop offset="1" stop-color="#5C6C8C"/></linearGradient>
    <linearGradient id="gSchool" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DCEAF8"/><stop offset="1" stop-color="#F6EBDC"/></linearGradient>
    <linearGradient id="gPark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#CFEAF8"/><stop offset="1" stop-color="#DFF3D8"/></linearGradient>
    <linearGradient id="gSalon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3EBFB"/><stop offset="1" stop-color="#E7DCF4"/></linearGradient>
    <linearGradient id="gClinic" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EAF4FB"/><stop offset="1" stop-color="#D8E9F5"/></linearGradient>
  </defs>`;

  let wOverlay = '';
  if (key === 'park' || key === 'school') {
    if (weather && weather.kind === 'rain') {
      wOverlay = `<g stroke="#7EC8E3" stroke-width="2.5" stroke-linecap="round" opacity=".75">
        ${Array.from({ length: 16 }, (_, i) => `<path d="M${8 + i * 13},${20 + (i % 5) * 22} l-4,12"/>`).join('')}</g>
        <rect width="220" height="250" fill="#5B7C99" opacity=".12"/>`;
    } else if (weather && weather.kind === 'snow') {
      wOverlay = `<g fill="#FFF" opacity=".9">
        ${Array.from({ length: 14 }, (_, i) => `<circle cx="${10 + i * 15}" cy="${(i * 37) % 200 + 10}" r="3.2"/>`).join('')}</g>
        <rect width="220" height="250" fill="#CFE4F2" opacity=".18"/>`;
    } else if (weather && weather.kind === 'thunder') {
      wOverlay = `<rect width="220" height="250" fill="#6B7A99" opacity=".22"/><path d="M100,8 l-14,26 h12 l-10,22 22,-30 h-12 z" fill="#FFD45E"/>`;
    } else if (weather && weather.kind === 'sunny' && weather.temp >= 30) {
      wOverlay = `<rect width="220" height="250" fill="#FFB35C" opacity=".12"/><circle cx="186" cy="42" r="20" fill="#FFD45E" opacity=".7"/>`;
    }
  }
  return `<svg viewBox="0 0 220 250" class="scene-svg" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">${defs}${svg}${wOverlay}</svg>`;
}
