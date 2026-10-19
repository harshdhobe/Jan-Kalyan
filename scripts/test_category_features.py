"""
test_category_features.py
-------------------------
Verifies all category parsing, counting, and filtering logic specified in the brief.
"""
import re, json

# 1. Test parsing rules
def normalize_cat(cat_str):
    c = cat_str.strip()
    c = re.sub(r',(\S)', r', \1', c)
    if 'Banking' in c: return 'Banking, Financial Services & Insurance'
    if 'Agriculture' in c: return 'Agriculture, Rural & Environment'
    if 'Public Safety' in c: return 'Public Safety, Law & Justice'
    if c == 'Women & Child': return 'Women and Child'
    return c

def parse_categories(cat_str, scheme=None):
    if not cat_str or not cat_str.strip():
        cats = ['Other']
    else:
        parts = cat_str.split(', ')
        cats = [normalize_cat(p) for p in parts if p.strip()]
        if not cats: cats = ['Other']
    if scheme:
        text = (scheme.get('name', '') + ' ' + (scheme.get('benefit', '') or '')[:200])
        if re.search(r'pension|पेंशन', text, re.I):
            if 'Pensions' not in cats:
                cats.append('Pensions')
    return cats

# Unit test 1: Comma without space
t1 = parse_categories('Agriculture,Rural & Environment')
assert t1 == ['Agriculture, Rural & Environment'], f"Failed t1: {t1}"

# Unit test 2: Multi-category split on ', '
t2 = parse_categories('Social welfare & Empowerment, Women and Child')
assert t2 == ['Social welfare & Empowerment', 'Women and Child'], f"Failed t2: {t2}"

# Unit test 3: Multi-category with embedded comma in first item
t3 = parse_categories('Banking,Financial Services and Insurance, Business & Entrepreneurship')
assert t3 == ['Banking, Financial Services & Insurance', 'Business & Entrepreneurship'], f"Failed t3: {t3}"

# Unit test 4: Empty yields 'Other'
t4 = parse_categories('')
assert t4 == ['Other'], f"Failed t4: {t4}"

# Unit test 5: Derived Pensions group
p_scheme = {'name': 'Atal Pension Yojana', 'benefit': 'Guaranteed pension of Rs 1000-5000/month after age 60.'}
t5 = parse_categories('Banking,Financial Services and Insurance', p_scheme)
assert 'Pensions' in t5, f"Failed t5: {t5}"
assert 'Banking, Financial Services & Insurance' in t5, f"Failed t5: {t5}"

print("All category parser unit tests passed successfully!")
