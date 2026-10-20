"""Read achievement definitions and story award sites; write guide data only."""
import hashlib
import json
from pathlib import Path
import re
import sys

SITE = Path(__file__).resolve().parents[1]
SOURCE = SITE.parent / 'mortal-tools'
sys.path.insert(0, str(SOURCE))
from export_library import ASSET, body, UnityPy


def main():
    env = UnityPy.load(str(ASSET))
    objects = {obj.path_id: obj for obj in env.objects}
    named = {}
    for obj in env.objects:
        if obj.type.name == 'MonoBehaviour':
            name, _ = body(obj)
            named.setdefault(name, []).append(obj)

    def get(name):
        assert len(named[name]) == 1, name
        return named[name][0]

    def award(reader):
        name, stat = body(objects[reader.pointer()])
        kind, prop, label = stat.int(), stat.int(), stat.string()
        return {'asset': name, 'label': label, 'type': kind,
                'property': prop, 'value': reader.int()}

    locale = json.loads((SOURCE / 'reference/story-reference/zh-cn.json').read_text())
    triggers = {}
    for path in sorted((SOURCE / 'reference/game-text').glob('*.lua')):
        for line_no, line in enumerate(path.read_text().splitlines(), 1):
            match = re.search(r'AddAchievementLib\("(\d+)"\)', line)
            if match:
                triggers.setdefault(match[1], []).append({'script': path.stem, 'line': line_no})

    collections = []
    for asset, label in [('LibraryDead', '夺命谱'), ('LibraryEndGame', '汗青书'),
                         ('LibraryAchievement', '风云史'), ('LibraryCg', '结局 CG')]:
        collection = get(asset)
        _, reader = body(collection)
        pointers = [reader.pointer() for _ in range(reader.int())]
        reader.finish()
        entries = []
        for pointer in pointers:
            ident, item = body(objects[pointer])
            note, title, desc = item.string(), item.string(), item.string()
            item.pointer()  # Picture
            item.int()  # Default collection count
            awards = [award(item) for _ in range(item.int())]
            item.finish()
            entry = {'id': ident, 'title': locale.get('Library/Title/' + ident, title),
                     'description': locale.get('Library/Desc/' + ident, desc),
                     'awardText': locale.get('Library/Award/' + ident, ''), 'awards': awards}
            if asset == 'LibraryAchievement':
                entry['triggers'] = triggers.get(ident, [])
                assert entry['title'] and entry['triggers'], ident
            entries.append(entry)
        assert len({entry['id'] for entry in entries}) == len(entries)
        collections.append({'asset': asset, 'name': label, 'count': len(entries), 'entries': entries})

    milestones = []
    for name in ['LibarayAward_Dead', 'LibarayAward_End']:
        _, reader = body(get(name))
        reader.string()  # Developer note
        maximum, collection_pointer = reader.int(), reader.pointer()
        tiers = []
        for _ in range(reader.int()):
            count = reader.int()
            tiers.append({'count': count, 'awards': [award(reader) for _ in range(reader.int())]})
        reader.finish()
        milestones.append({'asset': name, 'maximum': maximum, 'tiers': tiers})

    check_names = {'M20031_GE_5', 'M10023_01', 'G20000_LE_1', 'Ch_8_8_1_001',
                   'Ch_4_8_1_001', 'Ch_4_8_1_002', 'Ch_4_8_1_003', 'Ch_4_8_1_005',
                   'Ch_6_4_4_3_001', 'Ch_6_4_4_3_002'}
    checks = []
    for filename in ['switches.json', 'dice.json']:
        values = json.loads((SOURCE / 'reference/story-reference' / filename).read_text())
        checks.extend(value for value in values if value['name'] in check_names)

    result = {'gameVersion': '1.0.6000.4', 'verified': '2026-10-20',
              'assetSha256': hashlib.sha256(ASSET.read_bytes()).hexdigest(),
              'collections': collections, 'milestones': milestones,
              'conditionChecks': checks,
              'codeReferences': ['LibraryItemData', 'LibraryItemCollection', 'LibraryAwardData',
                                 'SaveSystem.NewGameData', 'LibraryPanel.OpenAchivementPanel',
                                 'StatModifyManager.AddAchievementLib', 'DiceMenuDialog.ExecuteRoll']}
    output = SITE / 'public/reference/achievements.json'
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'collections': {c['name']: c['count'] for c in collections},
                      'storyAwardSites': sum(len(v) for v in triggers.values())}, ensure_ascii=False))


if __name__ == '__main__':
    main()
