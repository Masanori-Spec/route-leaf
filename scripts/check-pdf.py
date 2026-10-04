#!/usr/bin/env python3
"""Inspect real PDF pages, Unicode text, embedded font, card IDs and destinations.

Usage: python3 scripts/check-pdf.py PDF MANIFEST [--render DIRECTORY]
Requires PyMuPDF; --render additionally uses Poppler pdftoppm for every page.
"""
import argparse, io, json, re, subprocess
from pathlib import Path
import fitz
from fontTools.ttLib import TTFont

parser=argparse.ArgumentParser()
parser.add_argument('pdf',type=Path)
parser.add_argument('manifest',type=Path)
parser.add_argument('--render',type=Path)
args=parser.parse_args()
m=json.loads(args.manifest.read_text())
doc=fitz.open(args.pdf)
ja='ja' in m['language'] or '日本語' in m['language']
pages=(len(m['cards'])+1)//2
answer_pages=(len(m['questions'])+9)//10
assert len(doc)==pages+answer_pages,(len(doc),pages,answer_pages)
assert doc[0].get_text().strip(), 'No extractable text'
cards={c['id']:c for c in m['cards']}
normalize=lambda s:re.sub(r'\s+','',s)
embedded=False
verified_fonts=set()
for pno,page in enumerate(doc):
    assert abs(page.rect.width-595.28)<.1 and abs(page.rect.height-841.89)<.1
    for item in page.get_fonts(full=True):
        name=item[3]
        if 'RouteLeafSans' in name:
            data=doc.extract_font(item[0])[3]
            assert data, 'RouteLeaf Unicode font is not embedded'
            if item[0] not in verified_fonts:
                # Text extraction alone can pass for a corrupt glyph subset.
                # Decompile every outline to catch broken short-loca offsets.
                embedded_font=TTFont(io.BytesIO(data))
                for glyph in embedded_font.getGlyphOrder():
                    embedded_font['glyf'][glyph].expand(embedded_font['glyf'])
                verified_fonts.add(item[0])
            embedded=True
    text=page.get_text()
    assert '\ufffd' not in text and '\u0000' not in text,'Replacement glyph in PDF text'
    assert normalize(m['title']) in normalize(text),'Missing title'
    # Every actual glyph box stays inside the page and clear of the paper edge.
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines',[]):
            for span in line['spans']:
                x0,y0,x1,y1=span['bbox']
                assert x0>=30 and y0>=20 and x1<=566 and y1<=823,(pno,span)
    if pno<pages:
        expected=m['cards'][pno*2:pno*2+2]
        for slot,card in enumerate(expected):
            top=[112,440][slot]
            cardtext=page.get_textbox(fitz.Rect(36,top,559.28,top+312))
            normalized=normalize(cardtext)
            assert re.search(r'\b'+re.escape(card['id'])+r'\b',cardtext),(pno,card['id'])
            assert normalize(card['source']) in normalized,(card['id'],'missing original source')
            assert normalize(card['label']) in normalized,(card['id'],'missing selected-language label')
            if card.get('hint'):assert normalize(card['hint']) in normalized,(card['id'],'missing hint')
            for group in card.get('groups',[]):assert normalize(group) in normalized,(card['id'],'missing group context')
            for option in card.get('options',[]):
                assert normalize(option['label']) in normalized,(card['id'],'missing choice')
            for nxt in [x['next'] for x in card['options']] if card['kind']=='select_one' else [card['next']]:
                route=('END / 終了' if ja else 'END / stop') if nxt=='END' else (f'{nxt} / 冊子 {cards[nxt]["page"]}ページ' if ja else f'{nxt} / booklet p. {cards[nxt]["page"]}')
                assert normalize(route) in normalized,(card['id'],'missing destination',route)
        expected_footer=f'冊子ページ {pno+1} / {pages}' if ja else f'Booklet page {pno+1} / {pages}'
        assert normalize(expected_footer) in normalize(text)
    else:
        assert ('回答用紙' if ja else 'ANSWER SHEET') in text
        assert not re.search(r'\bC\d{2,4}\b',text),'Card copies leaked into separate answer sheet'
        offset=(pno-pages)*10
        for i,q in enumerate(m['questions'][offset:offset+10],start=offset):
            assert normalize(f'{i+1}. {q["label"]}') in normalize(text),('answer sheet question missing',q['name'])
            assert text.splitlines().count(q['name'])==1,('original source not exactly once',q['name'])
assert embedded,'No embedded Unicode font found'
if args.render:
    args.render.mkdir(parents=True,exist_ok=True)
    prefix=args.render/args.pdf.stem
    subprocess.run(['pdftoppm','-png','-r','96',str(args.pdf),str(prefix)],check=True,capture_output=True)
    assert len(list(args.render.glob(args.pdf.stem+'-*.png')))==len(doc),'Not every page was rendered'
print(json.dumps({'pdf':str(args.pdf),'booklet_pages':pages,'answer_sheet_pages':answer_pages,'total_pages':len(doc),'cards_checked':len(cards),'unicode_embedded':embedded,'all_destinations_checked':True,'rendered_all_pages':bool(args.render)}))
