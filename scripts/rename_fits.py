"""Rename downloaded FIT files with their activity name from Intervals.icu."""
import asyncio, os, re, sys
sys.stdout.reconfigure(encoding='utf-8')
from aeroprofile.intervals.client import IntervalsClient

async def main():
    client = IntervalsClient('4wur2u4a5b6pzxkfcljjvaezt', 'i355768')
    acts = await client.list_activities('2024-04-01', '2026-04-10')

    name_map = {}
    for a in acts:
        safe = a.name
        for ch in ['/', '\\', ':', '?', '"', '<', '>', '|', '*']:
            safe = safe.replace(ch, '-')
        safe = re.sub(r'[^\w\s\-\.\(\)àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ]', '', safe)
        safe = safe.strip()[:80]
        name_map[a.id] = f'{a.start_date}_{safe}'

    src_dir = 'tests/fixtures/i355768'
    renamed = 0
    for fname in sorted(os.listdir(src_dir)):
        if not fname.endswith('.fit'):
            continue
        act_id = fname.split('_')[0]
        if act_id in name_map:
            new_name = name_map[act_id] + '.fit'
            old_path = os.path.join(src_dir, fname)
            new_path = os.path.join(src_dir, new_name)
            if old_path != new_path and not os.path.exists(new_path):
                os.rename(old_path, new_path)
                print(f'  {fname}  ->  {new_name}')
                renamed += 1
        else:
            print(f'  NO MATCH {fname}')
    print(f'\nRenamed {renamed} files')

asyncio.run(main())
