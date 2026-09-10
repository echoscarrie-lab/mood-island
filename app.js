const MOODS = [
  ['开心', '😄', '#ffe779'],
  ['平静', '😌', '#b8edcd'],
  ['疲惫', '😴', '#d7c3fa'],
  ['低落', '🥲', '#b7dfff'],
  ['生气', '😤', '#ffaba7'],
  ['焦虑', '😰', '#ffd0b0']
];

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const TIME_SLOTS = [
  '8:00–10:00',
  '10:00–12:00',
  '12:00–14:00',
  '14:00–16:00',
  '16:00–18:00',
  '18:00–20:00',
  '20:00–22:00',
  '22:00–24:00'
];
const ACTIVITY_HINTS = ['起床、吃早餐', '上课、处理一件事', '午饭、晒晒太阳', '见一个人、完成一步', '散步、运动一下', '晚饭、看看剧', '阅读、聊聊天', '洗澡、早点睡'];

const $ = id => document.getElementById(id);
const key = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = key(new Date());
let selected = today;
let week = monday(new Date());
let draft = [];
let data = {};
let activityData = {};
let objectUrl;
let activityStatusTimer;

try {
  data = JSON.parse(localStorage.getItem('mood-island-v1') || '{}');
  if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
} catch {
  data = {};
}

try {
  activityData = JSON.parse(localStorage.getItem('mood-island-activities-v1') || '{}');
  if (!activityData || typeof activityData !== 'object' || Array.isArray(activityData)) activityData = {};
} catch {
  activityData = {};
}

function monday(d) {
  const n = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  n.setDate(n.getDate() - (n.getDay() + 6) % 7);
  return n;
}

function dates() {
  return Array.from({length: 7}, (_, i) => {
    const d = new Date(week);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function record(k) {
  const x = data[k];
  return {
    moods: Array.isArray(x?.moods) ? x.moods.filter(i => Number.isInteger(i) && i >= 0 && i < 6) : [],
    note: typeof x?.note === 'string' ? x.note.slice(0, 160) : ''
  };
}

function render() {
  const ds = dates();
  $('range').textContent = `${ds[0].getMonth() + 1}月${ds[0].getDate()}日 — ${ds[6].getMonth() + 1}月${ds[6].getDate()}日`;
  $('days').replaceChildren();
  let count = 0;

  ds.forEach((d, i) => {
    const k = key(d);
    const r = record(k);
    if (r.moods.length || r.note) count++;
    const b = document.createElement('button');
    b.className = `day${k === selected ? ' active' : ''}${k === today ? ' today' : ''}`;
    b.setAttribute('aria-label', `${k}，${r.moods.map(j => MOODS[j][0]).join('、') || '未记录'}`);
    b.setAttribute('aria-pressed', String(k === selected));
    b.innerHTML = `<span class="date">${WEEKDAYS[i]}<br>${d.getDate()}</span><span class="face">${r.moods.length ? MOODS[r.moods[0]][1] : '＋'}</span><small>${r.moods.length ? MOODS[r.moods[0]][0] + (r.moods.length > 1 ? ` +${r.moods.length - 1}` : '') : '未记录'}</small>`;
    if (r.moods.length) b.style.background = MOODS[r.moods[0]][2];
    b.onclick = () => select(k);
    $('days').append(b);
  });

  $('summary').textContent = count ? `这周已经收好了 ${count} 天的你。` : '还没记录也没关系，从今天开始。';
  renderSchedule(ds);
}

function select(k) {
  selected = k;
  const r = record(k);
  draft = [...r.moods];
  $('note').value = r.note;
  $('selected').textContent = `${Number(k.slice(5, 7))}月${Number(k.slice(8))}日 · 今天的心情`;
  $('status').textContent = '';
  render();
  choices();
}

function choices() {
  $('moods').replaceChildren();
  MOODS.forEach((m, i) => {
    const b = document.createElement('button');
    b.className = `mood${draft.includes(i) ? ' on' : ''}`;
    b.style.background = m[2];
    b.innerHTML = `<span>${m[1]}</span>${m[0]}`;
    b.setAttribute('aria-pressed', String(draft.includes(i)));
    b.onclick = () => {
      draft = draft.includes(i) ? draft.filter(v => v !== i) : [...draft, i];
      choices();
    };
    $('moods').append(b);
  });
}

function save(k, moods, note) {
  data[k] = {moods: [...moods], note};
  try {
    localStorage.setItem('mood-island-v1', JSON.stringify(data));
    $('status').textContent = '收好啦，今天也有位置 ♥';
  } catch {
    $('status').textContent = '浏览器未能保存；请先导出心情卡。';
  }
  render();
}

function getActivityWeek(weekId) {
  const raw = activityData[weekId];
  if (!Array.isArray(raw)) return TIME_SLOTS.map(() => Array(7).fill(''));
  return TIME_SLOTS.map((_, row) => Array.from({length: 7}, (_, col) => {
    const value = raw[row]?.[col];
    return typeof value === 'string' ? value.slice(0, 80) : '';
  }));
}

function renderSchedule(ds) {
  const headRow = document.createElement('tr');
  const corner = document.createElement('th');
  corner.scope = 'col';
  corner.textContent = '时间';
  headRow.append(corner);
  ds.forEach((d, i) => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.innerHTML = `${WEEKDAYS[i]}<br><small>${d.getMonth() + 1}/${d.getDate()}</small>`;
    headRow.append(th);
  });
  $('activity-head').replaceChildren(headRow);

  const weekId = key(ds[0]);
  const values = getActivityWeek(weekId);
  const rows = TIME_SLOTS.map((slot, rowIndex) => {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = slot;
    tr.append(th);

    ds.forEach((d, colIndex) => {
      const td = document.createElement('td');
      const input = document.createElement('textarea');
      input.className = 'activity-cell';
      input.rows = 2;
      input.maxLength = 80;
      input.value = values[rowIndex][colIndex];
      input.placeholder = colIndex === 0 ? ACTIVITY_HINTS[rowIndex] : '';
      input.setAttribute('aria-label', `${WEEKDAYS[colIndex]} ${slot} 的活动`);
      input.addEventListener('input', () => saveActivity(weekId, rowIndex, colIndex, input.value));
      td.append(input);
      tr.append(td);
    });
    return tr;
  });
  $('activity-body').replaceChildren(...rows);
}

function saveActivity(weekId, rowIndex, colIndex, value) {
  const weekValues = getActivityWeek(weekId);
  weekValues[rowIndex][colIndex] = value.slice(0, 80);
  activityData[weekId] = weekValues;
  try {
    localStorage.setItem('mood-island-activities-v1', JSON.stringify(activityData));
    $('schedule-status').textContent = '刚刚自动收好 ✓';
    clearTimeout(activityStatusTimer);
    activityStatusTimer = setTimeout(() => {
      $('schedule-status').textContent = '内容会自动保存在当前浏览器。';
    }, 1600);
  } catch {
    $('schedule-status').textContent = '浏览器未能保存这张表，请检查隐私设置。';
  }
}

$('save').onclick = () => save(selected, draft, $('note').value.trim());

function changeWeek(n) {
  week.setDate(week.getDate() + n * 7);
  select(key(week));
}

$('prev').onclick = () => changeWeek(-1);
$('next').onclick = () => changeWeek(1);
$('thisweek').onclick = () => {
  week = monday(new Date());
  select(today);
};

$('share').onclick = async () => {
  const url = location.origin + location.pathname;
  try {
    if (navigator.share) {
      await navigator.share({title: '心情小岛', text: '来放一只今天的心情小团子 😺', url});
    } else {
      await navigator.clipboard.writeText(url);
      $('share').textContent = '链接复制好了 ✓';
    }
  } catch (error) {
    if (error.name !== 'AbortError') $('status').textContent = '可以复制浏览器地址，把小岛分享出去。';
  }
};

$('download').onclick = async () => {
  const b = $('download');
  b.disabled = true;
  b.textContent = '正在装好小情绪…';
  try {
    const c = document.createElement('canvas');
    c.width = 1000;
    c.height = $('include').checked ? 1450 : 990;
    const x = c.getContext('2d');
    x.fillStyle = '#ff9abe';
    x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#fff9e9';
    x.beginPath();
    x.roundRect(35, 35, 930, c.height - 70, 32);
    x.fill();
    x.strokeStyle = '#42213e';
    x.lineWidth = 4;
    x.stroke();
    x.fillStyle = '#42213e';
    x.font = 'bold 26px sans-serif';
    x.fillText('MOOD ISLAND · 我的心情小岛', 75, 100);
    x.font = 'bold 54px sans-serif';
    x.fillText('每一种心情，都有位置。', 75, 185);
    x.font = '26px sans-serif';
    x.fillText($('range').textContent, 75, 237);
    const img = new Image();
    img.src = 'moods.png';
    await img.decode();
    x.drawImage(img, 70, 260, 860, 287);
    dates().forEach((d, i) => {
      const r = record(key(d));
      const cx = 110 + i * 130;
      x.fillStyle = r.moods.length ? MOODS[r.moods[0]][2] : '#eee5ea';
      x.beginPath();
      x.roundRect(cx - 49, 570, 100, 175, 30);
      x.fill();
      x.stroke();
      x.fillStyle = '#42213e';
      x.textAlign = 'center';
      x.font = '23px sans-serif';
      x.fillText(['一', '二', '三', '四', '五', '六', '日'][i], cx, 610);
      x.font = '42px sans-serif';
      x.fillText(r.moods.length ? MOODS[r.moods[0]][1] : '·', cx, 670);
      x.font = '19px sans-serif';
      x.fillText(r.moods.length ? MOODS[r.moods[0]][0] + (r.moods.length > 1 ? ` +${r.moods.length - 1}` : '') : '未记录', cx, 718);
    });
    x.textAlign = 'left';
    let y = 810;
    if ($('include').checked) {
      x.font = '22px sans-serif';
      dates().forEach(d => {
        const r = record(key(d));
        const text = `${d.getMonth() + 1}/${d.getDate()}  ${r.moods.map(i => MOODS[i][0]).join('、')}${r.note ? ` · ${r.note}` : ''}`;
        const chars = [...text];
        let line = '';
        let lines = 0;
        for (let i = 0; i < chars.length; i++) {
          line += chars[i];
          if (x.measureText(line).width > 790) {
            x.fillText(line + (lines === 1 && i < chars.length - 1 ? '…' : ''), 80, y);
            y += 29;
            line = '';
            if (++lines === 2) break;
          }
        }
        if (line) {
          x.fillText(line, 80, y);
          y += 29;
        }
        y += 13;
      });
    }
    x.font = '24px sans-serif';
    x.fillText('一周七天，不必每天晴天。', 75, c.height - 105);
    x.font = '18px sans-serif';
    x.fillText('mood island  /  made with a little kindness', 75, c.height - 68);
    const blob = await new Promise(resolve => c.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Image export failed');
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(blob);
    $('cardimage').src = objectUrl;
    $('cardlink').href = objectUrl;
    $('carddialog').showModal();
  } catch {
    $('status').textContent = '图片没生成成功，请再试一次。';
  } finally {
    b.disabled = false;
    b.textContent = '生成心情卡 ↓';
  }
};

$('close').onclick = () => $('carddialog').close();
select(today);
