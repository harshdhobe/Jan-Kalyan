import json
from collections import defaultdict

with open('frontend/data/rules.js', 'r', encoding='utf-8') as f:
    content = f.read()

json_text = content.split('window.ALL_RULES = ', 1)[1].rsplit(';', 1)[0].strip()
rules = json.loads(json_text)
t2_rules = [r for r in rules if r.get('tier') == 2 or r.get('tier') == '2']
print(f"Total Tier-2 rules in bundle: {len(t2_rules)}")
print(f"Total Tier-1 rules in bundle: {len(rules) - len(t2_rules)}")

key_sizes = defaultdict(list)
for r in t2_rules:
    for k, v in r.items():
        size = len(json.dumps(v, ensure_ascii=False).encode('utf-8'))
        key_sizes[k].append(size)

print(f"\n{'Field':20s} | {'Total (KB)':>10s} | {'Avg (B)':>8s} | {'Min (B)':>8s} | {'Max (B)':>8s} | {'Share (%)':>10s}")
print('-' * 75)
total_all = sum(sum(v) for v in key_sizes.values())
for k, sizes in sorted(key_sizes.items(), key=lambda x: sum(x[1]), reverse=True):
    total_kb = sum(sizes) / 1024
    avg_b = sum(sizes) / len(sizes)
    min_b = min(sizes)
    max_b = max(sizes)
    share = (sum(sizes) / total_all) * 100
    print(f"{k:20s} | {total_kb:10.1f} | {avg_b:8.1f} | {min_b:8d} | {max_b:8d} | {share:9.1f}%")

print('-' * 75)
print(f"Total raw values size: {total_all / 1024:.1f} KB ({total_all / (1024*1024):.2f} MB)")
