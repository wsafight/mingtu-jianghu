// Unity's Mathf.RoundToInt rounds midpoint values to the nearest even integer.
const roundEven = (value: number) => {
  const floor = Math.floor(value);
  const fraction = value - floor;
  if (fraction === 0.5) return floor % 2 === 0 ? floor : floor + 1;
  return Math.round(value);
};
const contribution = (value: number, rate: number) => roundEven(Math.fround(Math.fround(value) * Math.fround(rate)));
const form = document.querySelector<HTMLFormElement>('#roll-form');
if (form) {
  const output = (id: string, value: string) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };
  const update = () => {
    const fields = Array.from(form.querySelectorAll<HTMLInputElement>('input'));
    const valid = fields.every((field) => field.checkValidity());
    const error = document.querySelector<HTMLElement>('#roll-error');
    if (error) error.hidden = valid;
    document.querySelector('#roll-output')?.classList.toggle('invalid-result', !valid);
    if (!valid) return;
    const value = (name: string) => Number((form.elements.namedItem(name) as HTMLInputElement).value);
    const modifier = value('sister') + value('disposition') + value('behaviour')
      + contribution(value('brother1'), -0.3) + contribution(value('brother2'), -0.3)
      + contribution(value('brother3'), -0.3) + contribution(value('brother4'), -0.2)
      + contribution(value('master'), -0.3);
    const needed = Math.max(1, 50 - modifier);
    const passing = Math.max(0, Math.min(99, 100 - needed));
    const possible = needed <= 99;
    const guaranteed = needed <= 1;
    const neededElement = document.getElementById('needed-roll');
    if (neededElement) {
      neededElement.replaceChildren(document.createTextNode(String(needed)));
      const suffix = document.createElement('span');
      suffix.textContent = ' / 99';
      neededElement.append(suffix);
    }
    output('total-modifier', modifier >= 0 ? `+${modifier}` : String(modifier));
    output('maximum-result', String(99 + modifier));
    output('passing-outcomes', `${passing} / 99 种`);
    output('result-status', !possible ? '当前条件无法通过' : guaranteed ? '所有基础骰点都能通过' : `基础骰点达到 ${needed} 即可过关`);
    output('roll-conclusion', !possible
      ? `最高总分只有 ${99 + modifier}，还差 ${50 - (99 + modifier)} 分。单纯重掷无效，需要调整好感或性格修正。`
      : guaranteed ? '当前修正已经足够。继续检查参战、金乌首战与其他剧情前置。'
      : '保留判定前的存档。重掷可能过关，仍以游戏界面的实际总分和剧情条件为准。');
    const result = document.querySelector<HTMLElement>('.roll-result');
    if (result) result.dataset.possible = String(possible);
    const meter = document.querySelector<HTMLElement>('#result-meter-fill');
    if (meter) meter.style.width = `${passing / 99 * 100}%`;
    try {
      localStorage.setItem('mingtu-roll-values', JSON.stringify(Object.fromEntries(fields.map((field) => [field.name, Number(field.value)]))));
    } catch { /* The calculator works without persistent storage. */ }
  };
  try {
    const values = JSON.parse(localStorage.getItem('mingtu-roll-values') ?? 'null');
    if (values && typeof values === 'object') {
      for (const field of Array.from(form.querySelectorAll<HTMLInputElement>('input'))) {
        if (typeof values[field.name] === 'number' && Number.isFinite(values[field.name])) field.value = String(values[field.name]);
      }
    }
  } catch { /* Discard invalid saved values. */ }
  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('input', update);
  form.addEventListener('reset', () => window.setTimeout(update, 0));
  update();
}
