"""Read the installed game's crafting data; writes only this guide's reference JSON."""
import json
import math
from pathlib import Path
import sys

SITE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SITE.parent / 'mortal-tools'))
from decode_route_conditions import Reader, ROOT, conditions
import UnityPy

objects = {}
for filename in ['globalgamemanagers.assets', 'sharedassets2.assets']:
    for obj in UnityPy.load(str(ROOT / filename)).objects:
        if obj.type.name != 'MonoBehaviour':
            continue
        data = obj.read(check_read=False)
        key = obj.assets_file.name + ':' + str(obj.path_id)
        objects[key] = (obj, {'name': data.m_Name, 'class': data.m_Script.deref().read().m_ClassName})

locale = json.loads((SITE.parent / 'mortal-tools/reference/story-reference/zh-cn.json').read_text())

def flag_modify(r):
    return {'flag': r.pointer(), 'value': r.int()}

def level(r):
    return {'points': r.int(), 'flags': r.array(lambda: flag_modify(r)), 'talents': r.array(r.pointer)}

def relation(r):
    return {'descriptionKey': r.string(), 'converts': r.array(r.pointer)}

def evolution(r):
    return {'target': r.pointer(), 'level': r.int(), 'refundRatio': r.float(), 'conditions': r.array(lambda: conditions(r))}

for key, (obj, data) in objects.items():
    cls = data['class']
    r = Reader(obj)
    if cls == 'UpgradeItemData':
        data.update(key=r.string(), note=r.string(), itemType=r.int(), currentPoints=r.int(), alreadyDeveloped=r.bool(), costPerPoint=r.int(), currentLevel=r.int(), sectLevel=r.int(), resetWhenMax=r.bool())
        data['levels'] = r.array(lambda: level(r))
        data['combat'] = r.array(lambda: relation(r))
        data['battle'] = r.array(lambda: relation(r))
        data['evolutions'] = r.array(lambda: evolution(r))
        data['rewards'] = r.array(lambda: {'item': r.pointer(), 'count': r.int()})
        data['icon'] = r.pointer()
    elif cls == 'UpgradeItemStatConvertData':
        def keyframe():
            return {'time': r.float(), 'value': r.float(), 'inSlope': r.float(), 'outSlope': r.float(), 'weightedMode': r.int(), 'inWeight': r.float(), 'outWeight': r.float()}
        data['curve'] = r.array(keyframe)
        data.update(preInfinity=r.int(), postInfinity=r.int(), rotationOrder=r.int(), testValue=r.int(), source=r.pointer())
    elif cls == 'FlagData':
        data.update(note=r.string(), default=r.int(), state=r.int())
    elif cls == 'GameStat':
        data.update(type=r.int(), property=r.int(), label=r.string())
        continue
    elif cls == 'RelationshipStat':
        data.update(type=r.int(), note=r.string())
        continue
    elif cls == 'StatGroupVariable':
        data['group'] = r.int()
        def value():
            item = {'type':r.int(), 'constant':r.int()}
            for field in ['stat','relationship','flag']: item[field] = r.pointer()
            item.update(randomMin=r.int(), randomMax=r.int())
            for field in ['book','misc','specialItem','talent','group']: item[field] = r.pointer()
            item['negative'] = r.bool()
            for field in ['gameTime','upgradeItem','bookCollection','achievement','condition']: item[field] = r.pointer()
            return item
        data['values'] = r.array(value)
    else:
        continue
    r.finish()

def describe(key, depth=0):
    if not key: return '无'
    d = objects[key][1]
    cls = d['class']
    if cls == 'StatGroupVariable':
        parts = []
        for v in d['values']:
            fields={1:'stat',2:'relationship',3:'flag',4:'book',5:'misc',6:'specialItem',8:'group',9:'gameTime',10:'talent',11:'book',12:'upgradeItem',13:'upgradeItem',14:'bookCollection',15:'achievement',16:'condition'}
            t=v['type']
            p=str(v['constant']) if t==0 else f"随机 {v['randomMin']}–{v['randomMax']}" if t==7 else describe(v[fields[t]],depth+1)
            if v['negative']: p='−('+p+')'
            parts.append(p)
        return parts[0] if len(parts)==1 else {1:'SUM',2:'MAX',3:'MIN',4:'MULTIPLY'}[d['group']]+'('+', '.join(parts)+')'
    if cls == 'GameStat': return d['label'] or d['name']
    if cls == 'RelationshipStat': return d['note'] or d['name']
    if cls == 'FlagData': return d['name']+' ('+d['note'].replace('\r\n',' / ')+')'
    if cls == 'UpgradeItemData': return locale.get('Equip/Name/'+d['key'],d['note'])
    if cls in ['SpecialItem', 'Misc', 'Book']:
        r = Reader(objects[key][0])
        r.string()  # ItemData._devNote
        ident = r.string()
        prefix = {'SpecialItem': 'Special', 'Misc': 'Misc', 'Book': 'Book'}[cls]
        return locale.get(prefix+'/Name/'+ident, d['name'])
    return d['name']

items = []
used_converts = set()
for key,(obj,d) in objects.items():
    if d['class']!='UpgradeItemData': continue
    d['asset'] = key
    d['displayName'] = locale.get('Equip/Name/'+d['key'],d['note'])
    d['description'] = locale.get('Equip/Desc/'+d['key'],'')
    for rel in d['combat']+d['battle']:
        rel['description'] = locale.get('UpgradeItemRelationDesc/'+rel['descriptionKey'],rel['descriptionKey'])
        used_converts.update(rel['converts'])
    for evo in d['evolutions']:
        evo['targetKey'] = objects[evo['target']][1]['key']
        evo['targetName'] = describe(evo['target'])
        for c in evo['conditions']:
            c['expression'] = (' '+c['logic']+' ').join(describe(i['left'])+' '+i['op']+' '+describe(i['right']) for i in c['items'])
    for rew in d['rewards']:
        rew['displayName'] = describe(rew['item'])
    d['maxLevel'] = len(d['levels'])
    d['pointsToMax'] = sum(v['points'] for v in d['levels'])
    d['moneyToMax'] = d['pointsToMax']*d['costPerPoint']
    items.append(d)
output={'gameVersion':'1.0.6000.4','verified':'2026-10-20','items':items,'converts':{k:objects[k][1] for k in sorted(used_converts)}}

def json_safe(value):
    # Unity step curves use infinite tangent slopes. Keep them as strings in JSON.
    if isinstance(value, float) and not math.isfinite(value):
        return 'NaN' if math.isnan(value) else 'Infinity' if value > 0 else '-Infinity'
    if isinstance(value, dict): return {key: json_safe(item) for key, item in value.items()}
    if isinstance(value, list): return [json_safe(item) for item in value]
    return value

(SITE/'public/reference/crafting.json').write_text(json.dumps(json_safe(output),ensure_ascii=False,indent=2,allow_nan=False)+'\n')
print('items',len(items),'converts',len(used_converts))
for d in items:
    print(d['key'],d['displayName'],'sect',d['sectLevel'],'level',d['maxLevel'],'cost',d['costPerPoint'],'max',d['pointsToMax'], 'rewards',d['rewards'])
    for e in d['evolutions']:
        print(' ->',e['targetName'],'Lv',e['level'],[c['expression'] for c in e['conditions']])
