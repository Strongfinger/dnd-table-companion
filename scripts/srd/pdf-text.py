# Writes the text of the official SRD 5.2.1 PDF to a text file, for scripts/srd/magic-items.mjs.
# Needs pypdf (pip install pypdf), e.g. in a throwaway venv:
#
#   python3 -m venv /tmp/srd/venv && /tmp/srd/venv/bin/pip install pypdf
#   /tmp/srd/venv/bin/python scripts/srd/pdf-text.py /tmp/srd/SRD_CC_v5.2.1.pdf /tmp/srd/srd.txt
import sys

import pypdf

source, target = sys.argv[1:3]
with open(target, 'w', encoding='utf-8') as out:
    for number, page in enumerate(pypdf.PdfReader(source).pages, start=1):
        out.write(f'\n=====PAGE {number}=====\n')
        out.write(page.extract_text() or '')
