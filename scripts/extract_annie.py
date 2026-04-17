import fitz

doc = fitz.open('Annie Script Unlocked SHortened.pdf')
print(f'Total pages: {doc.page_count}')

# Check font info on page 1
page = doc[0]
d = page.get_text('dict')
print('\nFont info from page 1:')
for block in d.get('blocks', []):
    for line in block.get('lines', []):
        for span in line.get('spans', []):
            font = span.get('font')
            size = span.get('size', 0)
            text = span.get('text')
            print(f'  font={font}, size={size:.1f}, text={repr(text)}')

# Look for a page with more content
print('\n\nSearching for content-rich pages...')
for i in range(doc.page_count):
    page = doc[i]
    # Try rawtext which shows unmapped chars
    raw = page.get_text('rawtext')
    if len(raw.strip()) > 50:
        print(f'\n=== PAGE {i+1} (rawtext, {len(raw)} chars) ===')
        print(raw[:800])
        break

# Also try XML
print('\n\nPage 1 XML (font names):')
xml = doc[0].get_text('xml')
print(xml[:1000])
