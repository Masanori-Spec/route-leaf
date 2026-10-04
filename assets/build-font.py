import zlib
"""Rebuild local OFL font from Debian fonts-noto-cjk, never at application runtime."""
from pathlib import Path
from fontTools.ttLib import TTCollection
from fontTools import subset
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
import base64, hashlib, json
root = Path(__file__).parent
source = Path('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc')
font = TTCollection(source).fonts[0]  # Japanese glyph forms
# Latin, punctuation, kana, CJK unified ideographs, full-width forms. Reject
# unsupported glyphs in layout validation instead of printing replacement boxes.
ranges = [(0x20,0x024F),(0x2000,0x206F),(0x2100,0x21FF),(0x3000,0x30FF),
          (0x31F0,0x31FF),(0x3400,0x4DBF),(0x4E00,0x9FFF),(0xFF00,0xFFEF)]
options = subset.Options()
options.layout_features = []  # One glyph per code point; PDF and HTML fit identically.
options.name_IDs = ['*']
options.name_legacy = True
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=[c for a,b in ranges for c in range(a,b+1)])
subsetter.subset(font)
# Convert static cubic outlines to quadratic outlines. This avoids old fontkit
# CFF-subsetter limitations while retaining original advance widths and cmap.
glyph_set = font.getGlyphSet()
glyph_order = font.getGlyphOrder()
glyphs = {}
for name in glyph_order:
    pen = TTGlyphPen(glyph_set)
    glyph_set[name].draw(Cu2QuPen(pen, max_err=1.0, reverse_direction=True))
    glyphs[name] = pen.glyph()
builder = FontBuilder(font['head'].unitsPerEm, isTTF=True)
builder.setupGlyphOrder(glyph_order)
builder.setupCharacterMap(font.getBestCmap())
builder.setupGlyf(glyphs)
builder.setupHorizontalMetrics(font['hmtx'].metrics)
builder.setupHorizontalHeader(ascent=font['hhea'].ascent, descent=font['hhea'].descent)
builder.setupNameTable({'familyName':'RouteLeaf Sans','styleName':'Regular','uniqueFontIdentifier':'RouteLeafSans-Regular-1','fullName':'RouteLeaf Sans Regular','psName':'RouteLeafSans-Regular','version':'Version 1.0','copyright':'Copyright 2014-2021 Adobe (http://www.adobe.com/). Derived from Noto Sans CJK JP.','licenseDescription':'SIL Open Font License, Version 1.1. See OFL.txt.','licenseInfoURL':'https://openfontlicense.org'})
builder.setupOS2(sTypoAscender=font['OS/2'].sTypoAscender,sTypoDescender=font['OS/2'].sTypoDescender,usWinAscent=font['OS/2'].usWinAscent,usWinDescent=font['OS/2'].usWinDescent)
builder.setupPost(keepGlyphNames=False)
font = builder.font
# Modified font uses its own family name as a conservative OFL naming choice.
for entry in font['name'].names:
    if entry.nameID in (1,4,6,16):
        name = 'RouteLeafSans-Regular' if entry.nameID == 6 else 'RouteLeaf Sans'
        entry.string = name.encode(entry.getEncoding(), errors='replace')
font['glyf'].padding = 4  # fontkit subsets use short loca; keep each glyph 4-byte aligned.
font.flavor = None
output = root/'routeleaf-sans.ttf'
font.save(output)
encoded = base64.b64encode(zlib.compress(output.read_bytes(),9)).decode('ascii')
module = "// Losslessly compressed local font; see OFL.txt and FONT-PROVENANCE.md.\nimport pako from 'pako';\nconst compressed = __DATA__;\nconst bytes = pako.inflate(Uint8Array.from(atob(compressed), c => c.charCodeAt(0)));\nconst chunks=[]; for(let i=0;i<bytes.length;i+=16384)chunks.push(String.fromCharCode(...bytes.subarray(i,i+16384)));\nexport const FONT_BASE64 = btoa(chunks.join(''));\n"
(root/'font-data.mjs').write_text(module.replace('__DATA__',json.dumps(encoded)))
print('source sha256',hashlib.sha256(source.read_bytes()).hexdigest())
print('ttf bytes',output.stat().st_size)
