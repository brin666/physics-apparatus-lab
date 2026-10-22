"""Validate captured media and package the delivery; no image content is edited."""
from pathlib import Path
from PIL import Image
import hashlib
import html
import json
import subprocess
import zipfile

project = Path(__file__).resolve().parents[1]
root = project / 'exports' / '2026-10-19-social-media'
ffmpeg = project / '.tools/media-py/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
devices = [('engine', '汽油机'), ('fridge', '电冰箱'), ('ac', '空调'), ('joule', '焦耳实验'), ('gas', '气体状态实验台')]
titles = ['物理器械室首页', '汽油机：做功冲程', '汽油机：总成拆解', '电冰箱：内部管路', '空调：室内外机', '焦耳实验：搅拌与做功', '气体实验台：等温压缩', '气体实验台：p–V 状态轨迹']
report = {'capture': '真实网页与 Three.js 场景逐帧截图；按展示时间推进已有模型。', 'screenshots': [], 'animations': [], 'errors': []}
deliverables = []
shots = sorted((root / 'screenshots').glob('[0-9][0-9]-*.png'))
assert len(shots) == 8, f'Expected 8 PNGs, found {len(shots)}'
for path, title in zip(shots, titles):
    with Image.open(path) as image:
        assert image.size == (1080, 1440), (path.name, image.size)
        assert image.format == 'PNG'
        image.verify()
    deliverables.append(path)
    report['screenshots'].append({'file': f'screenshots/{path.name}', 'title': title, 'width': 1080, 'height': 1440, 'bytes': path.stat().st_size})
print('PASS 8 PNGs, 1080x1440, full decode and dimensions', flush=True)

for device, label in devices:
    for motion, motion_label in [('assembly', '逐步组装'), ('operation', '运行演示')]:
        stem = f'{device}-{motion}'
        gif, video = root / 'gifs' / f'{stem}.gif', root / 'videos' / f'{stem}.mp4'
        assert gif.is_file() and video.is_file(), stem
        duration_ms, samples = 0, set()
        with Image.open(gif) as image:
            assert image.size == (720, 960), (stem, image.size)
            assert image.format == 'GIF' and image.info.get('loop') == 0
            frames = image.n_frames
            assert frames >= 60, (stem, frames)
            for index in range(frames):
                image.seek(index)
                image.load()
                duration_ms += image.info.get('duration', 0)
                if index % 10 == 0:
                    samples.add(hashlib.sha256(image.convert('RGB').tobytes()).hexdigest())
        assert len(samples) >= 4, f'{stem} appears static'
        assert 4 <= duration_ms / 1000 <= 12, (stem, duration_ms)
        subprocess.run([str(ffmpeg), '-hide_banner', '-loglevel', 'error', '-i', str(video), '-f', 'null', '-'], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=True)
        entry = {'device': device, 'name': label, 'motion': motion, 'title': f'{label} · {motion_label}', 'gif': f'gifs/{stem}.gif', 'video': f'videos/{stem}.mp4', 'width': 720, 'height': 960, 'sourceFps': 15, 'gifFrames': frames, 'durationSeconds': duration_ms / 1000, 'distinctSamples': len(samples), 'gifBytes': gif.stat().st_size, 'videoBytes': video.stat().st_size}
        report['animations'].append(entry)
        deliverables.extend([gif, video])
        print(f'PASS {stem}: {frames} frames, {duration_ms / 1000:.2f}s, {len(samples)} changing samples; MP4 decoded', flush=True)

gif_lookup = {(item['device'], item['motion']): item for item in report['animations']}
rows = '\n'.join(f"| {item['title']} | {item['durationSeconds']:.2f} 秒 | {item['gifBytes'] / 1048576:.2f} MB | `{item['gif']}` |" for item in report['animations'])
readme = f'''# 物理器械室展示素材

导出日期：2026-10-19。共 10 个 GIF、10 个配套 MP4、8 张 PNG 截图。

- `screenshots/`：1080×1440，3:4 竖版，保留实际网页交互界面。
- `gifs/`：720×960，3:4 竖版，15 帧/秒，循环播放，留有首尾停顿。
- `videos/`：对应 GIF 的 MP4，方便剪辑与二次使用。
- `index.html`：可本地打开的素材预览页。

画面来自项目现有网页和真实 Three.js 模型。动画按固定帧率逐帧采集，播放时长按展示节奏安排，不代表真实器械的工作速率。GIF 隐藏操作按钮，让机构运动和组装步骤更清楚；截图保留网页界面。组装是教学展示顺序。

## 动画目录

| 内容 | 时长 | GIF 体积 | 文件 |
| --- | --- | --- | --- |
{rows}

## 截图目录

''' + '\n'.join(f"- `{item['file']}`：{item['title']}" for item in report['screenshots']) + '''

建议先用 `01-home.png` 展示全貌，再选器材截图；GIF 可选汽油机运行或空调组装作为动态展示。

PNG 尺寸、GIF 逐帧解码与循环标记、MP4 完整解码均已检查。`manifest.json` 记录文件规格与检查结果。
'''
(root / 'README.md').write_text(readme, encoding='utf-8')

cards = []
for device, label in devices:
    clips = []
    for motion, motion_label in [('assembly', '逐步组装'), ('operation', '运行演示')]:
        item = gif_lookup[(device, motion)]
        clips.append(f'''<details {'open' if device == 'engine' and motion == 'operation' else ''}><summary>{motion_label} · {item['durationSeconds']:.2f} 秒</summary><img class="gif" src="{item['gif']}" loading="lazy" width="720" height="960" alt="{html.escape(item['title'])}"><p><a href="{item['gif']}" download>下载 GIF</a><a href="{item['video']}" download>下载 MP4</a></p></details>''')
    cards.append(f'<article><h3>{label}</h3>{"".join(clips)}</article>')
shot_cards = ''.join(f'''<a class="shot" href="{item['file']}"><img src="{item['file']}" width="1080" height="1440" loading="lazy" alt="{html.escape(item['title'])}"><span>{html.escape(item['title'])}</span></a>''' for item in report['screenshots'])
gallery = f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>物理器械室 · 展示素材</title><style>
:root{{font-family:"Microsoft YaHei",sans-serif;color:#24374c;background:#fff}}*{{box-sizing:border-box}}body{{margin:0;background-image:linear-gradient(#edf2fa 1px,transparent 1px),linear-gradient(90deg,#edf2fa 1px,transparent 1px);background-size:32px 32px}}main{{max-width:1180px;margin:auto;padding:48px 24px 80px}}h1{{font-size:32px;margin:0 0 12px}}h2{{font-size:24px;margin:40px 0 18px}}header p{{color:#63778f;line-height:1.8}}.grid{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}}article,.shot{{background:#fff;border:1px solid #dce5f3;border-radius:16px;padding:18px}}h3{{margin:0 0 16px;font-size:19px}}details{{margin-top:10px}}summary{{cursor:pointer;padding:12px;background:#edf4ff;border-radius:8px;color:#326bd0;font-size:14px}}.gif{{display:block;width:100%;height:auto;margin-top:12px}}details p{{display:flex;gap:20px}}a{{color:#326bd0}}.shots{{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}}.shot{{display:block;padding:8px;text-decoration:none}}.shot img{{display:block;width:100%;height:auto;border-radius:8px}}.shot span{{display:block;font-size:12px;line-height:1.6;margin:10px 6px}}@media(max-width:800px){{.grid{{grid-template-columns:repeat(2,minmax(0,1fr))}}.shots{{grid-template-columns:repeat(2,minmax(0,1fr))}}}}@media(max-width:480px){{.grid{{grid-template-columns:1fr}}main{{padding:30px 16px}}h1{{font-size:26px}}}}
</style></head><body><main><header><h1>物理器械室 · 展示素材</h1><p>10 个组装与运行动画 · 8 张竖版截图<br>GIF / MP4：720×960；PNG：1080×1440。点击展开动画，点击截图查看原图。</p></header><h2>组装与运行</h2><div class="grid">{''.join(cards)}</div><h2>小红书竖版截图</h2><div class="shots">{shot_cards}</div></main></body></html>'''
(root / 'index.html').write_text(gallery, encoding='utf-8')
report['totals'] = {'gifs': 10, 'videos': 10, 'screenshots': 8, 'mediaBytes': sum(path.stat().st_size for path in deliverables)}
(root / 'manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
deliverables.extend(root / name for name in ['README.md', 'index.html', 'manifest.json'])
archive = root.parent / '物理器械室-展示素材-2026-10-19.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as package:
    for path in deliverables:
        package.write(path, path.relative_to(root).as_posix())
with zipfile.ZipFile(archive) as package:
    assert package.testzip() is None
    assert len(package.infolist()) == 31
print(json.dumps({'archive': str(archive), 'bytes': archive.stat().st_size, 'files': len(deliverables), 'media': report['totals']}, ensure_ascii=False), flush=True)
