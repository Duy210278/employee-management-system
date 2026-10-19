#!/usr/bin/env python3
"""
Trích checklist onboarding Cửa hàng trưởng từ hai file Excel của BP Đào tạo
(docs/nguon/Onboarding_CHT_MoiTuyen_[TenCHT].xlsx, Onboarding_CHT_TuNVBH_[TenCHT].xlsx)
thành mẫu mặc định packages/shared/src/defaults/cht-tracks.ts.

Chạy lại khi BP Đào tạo sửa file Excel:  python3 seed/extract-cht.py
Cần openpyxl (pip install openpyxl).

Quy ước suy ra từ file:
- Mỗi "Ngày D+n" là một giai đoạn [n, n+1]; hạn đầu việc là chính ngày đó.
- Cột "Người hỗ trợ" giữ nguyên làm chữ hiển thị; người xác nhận suy ra:
  Đào tạo → BP ĐT; QLKV → QLKV (dấu "+" là cùng tham gia, dấu "/" là một trong hai, ưu tiên Đào tạo);
  còn lại (NV kỳ cựu, HR, CHT tự làm) → Đào tạo xác nhận khi check-in cuối ngày.
- Việc của chính Đào tạo (check-in, "Đào tạo …") và họp tổng kết: không cần CHT báo trước.
"""
import json
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SOURCES = [
    ('cht_moi_tuyen', 'CM', 'CHT mới tuyển', ROOT / 'docs/nguon/Onboarding_CHT_MoiTuyen_[TenCHT].xlsx'),
    ('cht_thang_tien', 'CT', 'CHT thăng tiến từ NVBH', ROOT / 'docs/nguon/Onboarding_CHT_TuNVBH_[TenCHT].xlsx'),
]
OUT = ROOT / 'packages/shared/src/defaults/cht-tracks.ts'
SESSION = {'sáng': 'sang', 'chiều': 'chieu', 'cuối ngày': 'cuoi_ngay'}
RATING_KEYS = {
    'Mức độ làm quen vận hành cửa hàng': 'van_hanh',
    'Khả năng xử lý tình huống thực tế': 'tinh_huong',
    'Mối quan hệ với đội nhóm': 'doi_nhom',
    'Khả năng chuyển đổi tư duy (không nhảy vào làm thay NV)': 'chuyen_doi_tu_duy',
    'Mối quan hệ với đồng nghiệp cũ': 'dong_nghiep_cu',
}


def clean(v):
    """Bỏ khoảng trắng thừa và ký tự biến thể emoji (U+FE0F) lọt vào đầu ô"""
    return re.sub(r'\s+', ' ', str(v or '').replace('️', '')).strip()


def sentence(text):
    """Chữ in hoa toàn bộ → viết hoa chữ đầu, giữ nguyên các từ viết tắt"""
    out = text[:1].upper() + text[1:].lower() if text.isupper() else text
    for abbr in ('CHT', 'NVBH', 'QLKV', 'POS', 'LMS'):
        out = re.sub(rf'\b{abbr.lower()}\b', abbr, out)
    return out[:1].upper() + out[1:]


def sheet(wb, marker):
    return next(ws for ws in wb.worksheets if marker in ws.title)


def verifiers_of(supporter):
    has_dt = 'Đào tạo' in supporter
    has_ql = 'QLKV' in supporter
    roles = []
    if has_dt:
        roles.append('bp')
    if has_ql and ('+' in supporter or not has_dt):
        roles.append('qlkv')
    return roles or ['bp']


def track(key, code, name, path):
    wb = openpyxl.load_workbook(path)
    info, check, log = sheet(wb, 'Thông tin'), sheet(wb, 'Checklist'), sheet(wb, 'Nhật ký')

    title = clean(check['A1'].value).lstrip('✅ ').strip()
    goal = sentence(clean(check['A2'].value).split('·')[0].replace('Mục tiêu:', '').strip())
    tip = clean(check['A4'].value).lstrip('💡 ').strip()
    notes = [clean(c.value) for row in info.iter_rows(min_col=2, max_col=2) for c in row if clean(c.value)[:1] in ('📌', '✅', '🎯', '⚠')]

    days = {}
    for r in range(11, check.max_row + 1):
        content = clean(str(check.cell(r, 4).value or '').replace('\n', '; '))
        if not content:
            continue
        day_label = clean(check.cell(r, 2).value)
        m = re.match(r'Ngày D(?:\+(\d+))?$', day_label)
        if not m:
            sys.exit(f'{path.name} dòng {r}: không đọc được ngày "{day_label}"')
        n = int(m.group(1) or 0)
        days.setdefault(n, []).append((r, day_label, content))

    stages = []
    for n in sorted(days):
        items = []
        for order, (r, day_label, content) in enumerate(days[n], start=1):
            supporter = clean(check.cell(r, 5).value)
            category = re.sub(r'^[^\wÀ-ỹ]+', '', clean(check.cell(r, 6).value))
            trainer_task = category == 'Check-in' or content.startswith('Đào tạo') or category == 'Họp tổng kết'
            item = {
                'key': f'{code}-{n + 1}-{order}',
                'order': order,
                'category': category,
                'content': content.replace(' ; ', '; '),
                'guidance': '',
                'verifiers': verifiers_of(supporter),
                'requireNvFirst': not trainer_task,
                'dueOffset': n,
                'gpp': False,
                'required': True,
                'allowNa': True,
                'dataSource': 'manual',
                'evidence': 'none',
                'dependsOn': [],
                'sourceRef': f'{path.name}#{r}',
                'session': SESSION.get(clean(check.cell(r, 3).value).lower()),
                'supporter': supporter,
                'link': clean(check.cell(r, 9).value),
            }
            items.append(item)
        cats = []
        for it in items:
            if it['category'] not in cats and it['category'] != 'Check-in':
                cats.append(it['category'])
        stages.append({
            'key': f'{code}-S{n + 1}',
            'order': n + 1,
            'name': ', '.join(cats),
            'label': days[n][0][1],
            'offsetStart': n,
            'offsetEnd': n + 1,
            'goal': '',
            'signers': [],
            'items': items,
        })

    moods, ratings = [], []
    for dv in log.data_validations.dataValidation:
        options = [o.strip() for o in (dv.formula1 or '').strip('"').split(',')]
        if 'C5' in str(dv.sqref):
            moods = [o for o in options if o and o != '–']
    for r in range(12, log.max_row + 1):
        label = clean(log.cell(r, 1).value)
        if label in RATING_KEYS:
            ratings.append({'key': RATING_KEYS[label], 'label': label})

    return {
        'key': key,
        'code': code,
        'name': name,
        'title': sentence(title),
        'goal': goal,
        'tip': tip,
        'notes': notes,
        'totalDays': max(days) + 1,
        'moods': moods,
        'ratings': ratings,
        'stages': stages,
    }


tracks = [track(*s) for s in SOURCES]
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(
    "import type { ChtTrack } from '../schemas/version';\n\n"
    "/**\n"
    " * Mẫu checklist onboarding Cửa hàng trưởng, trích từ docs/nguon/Onboarding_CHT_*.xlsx bằng seed/extract-cht.py.\n"
    " * Không sửa tay: sửa file Excel rồi chạy lại script.\n"
    " */\n"
    f"export const DEFAULT_CHT_TRACKS: ChtTrack[] = {json.dumps(tracks, ensure_ascii=False, indent=2)};\n",
    encoding='utf-8',
)
for t in tracks:
    n = sum(len(s['items']) for s in t['stages'])
    print(f"{t['name']}: {len(t['stages'])} ngày, {n} việc, {len(t['moods'])} cảm xúc, {len(t['ratings'])} tiêu chí chấm sao")
print('→', OUT.relative_to(ROOT))
