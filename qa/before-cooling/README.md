# 热能实验室 · 汽油机教学样板

先认部件，再观察协作：单缸、双气门四冲程汽油机。

直接双击 `index.html` 可离线查看。3D 引擎、SVG 工具、样式和教学模型均已打包到这一个 HTML 中，不需要网络字体或 CDN。使用 Chrome / Edge 等支持 WebGL2 的浏览器。

开发与本地预览：

```powershell
npm.cmd install
npm.cmd run build
npm.cmd start
```

打开 http://127.0.0.1:4198/ 。修改源文件后需重新 build；`index.html` 是生成文件。

- 立体剖面：整体、半剖、总成拆解、透视；选择部件高亮与查看讲解。
- 连续过程：暂停、慢放、下一冲程、0–720° 拖动；同一个几何模型驱动运动与阶段状态。
- 播放、模型方式和白板入口使用浅金黄色控件。播放按钮在“开始／暂停／继续”间保持大小；模型下方同步显示四冲程进度。运转时部件标注保留名称，暂停后显示测量数值。
- 纸上结构：Anatomy 等距 SVG 定位图，固定姿态；不用于展示当前曲轴角度。开始运转或拖角度会切回立体视图。
- 鼠标拖动旋转、滚轮缩放；触屏单指滑动页面，双指旋转缩放。页面提供还原、放大、缩小按钮。
- 键盘：Tab 遍历按钮；角度条用方向键调节；视图标签用左右键切换；模型聚焦时空格播放/暂停、左右键步进、R 还原。
- 首次进入用约6秒完成8步组装入场，部件连续落位，结束后保持完整剖面，可直接进入教学；底部可暂停、跳步、重播或直接看完整结构。
- 顶部四个章节入口已移除。右上“构造与冲程”展开灰蓝色圆角浮卡，分为“认识构造”“四个冲程”，模型保持原尺寸。构造页选择部件或纸上结构；四冲程页包含冲程选择、播放、角度、速度、状态与能量说明。
- 浮卡从上向下展开，用240ms的clip-path、透明度与少量位移过渡；快速重复点击可反转，键盘与减弱动效模式即时开合。打开卡片会暂停入场；切到四冲程或选部件后显示完整模型。卡片内“重播入场”可重看组装。
- 课堂白板：保持真实模型，暂停教学时钟；可切换模型旋转和画笔、荧光笔、橡皮、文字、直线、箭头，支持撤销、重做、清空。桌面模型偏左，右侧留出板书空间。
- 板书保存在当前浏览器；本地板书可恢复对应教学时刻、模型视角和笔迹。它们属于屏幕上的批注，转动模型会改变与结构的相对位置。清理浏览器数据会失去板书；保存失败会明确提示。
- 系统要求减弱动态效果时，初始模型静止。点击组装后每步直接落位，用“下一步”查看，不自动滑入或试运行。
- 组装次序用于讲清构造和连接关系，不等同于制造或维修中的真实装配工艺。

## 教材与参考

教材对应已核对的人教版旧版九年级全一册第十四章“内能的利用”第一节“热机”，汽油机结构及四冲程见18–19页。此处不把旧版页码冒充新版页码。

- 人教社旧版目录：https://www.pep.com.cn/products/jc/czjks/201510/t20151026_1250822.shtml
- 已核对的公开旧版页面：https://www.haoduoyun.cc/book/rjb/wuli/9/18.shtml 、 https://www.haoduoyun.cc/book/rjb/wuli/9/19.shtml
- 原理参考：NASA，Internal Combustion Engine – Otto Cycle：https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/internal-combustion-engine-otto-cycle/

本模型采用自定教学示意尺寸（缸径80 mm、行程72 mm、连杆116 mm），不对应具体实机。不计算燃烧动力学、真实温度/压强、效率或输出功率；气体颜色是阶段提示。配气、冷却、润滑省略。点火和配气时刻为课本式理想化示意；总成分离表达结构，不是维修指导。

## 源文件

`index.source.html` / `style.css` / `app.mjs` 是主界面；`whiteboard.mjs` / `whiteboard.css` / `whiteboard-store.mjs` 为白板；`model.mjs` 为纯运动学与教学数据；`anatomy.mjs` 为等距结构图；`machine.html` / `machine-scene.mjs` 为立体场景。`build.mjs` 将全部功能打包。

## 验证

```powershell
npm.cmd test
npm.cmd run qa
node qa/gold-controls.mjs
```

模型测试验证止点、连杆与曲柄长度、气门状态、净空、一次循环一次点火、角度确定性、组装顺序，以及板书存储恢复和失败处理。当前浏览器验证见 qa/redesign-browser.mjs：自动入场、八步组装、浮卡动画与快速反转、键盘双页切换、卡片内播放/步进/速度/角度、各模型方式、纸上结构、白板及历史恢复、390px视口、离线与减弱动态效果。浏览器检查使用本机无头Chrome，手机为模拟触摸视口。结果见 qa/card-results.json 与 card-*.png；之前改版证据保留在qa目录。

浅金黄控件专项检查见 qa/gold-controls.mjs：播放状态与尺寸稳定、动态数值显隐、四冲程进度、白板暂停与360/390px布局。结果与截图保存在 qa/gold-results.json 和 gold-*.png。

## 工具与授权

Anatomy：https://github.com/wheresryan22/anatomy ，Machine：https://github.com/AirsupHQ/machine-skill 。复用工具代码位于 `vendor/`，分别保留 MIT LICENSE。Three.js 0.170.0 按 MIT 授权。原生 SVG 与 Three.js 共同绘制，未复制教材插图；教学文字是本站整理。
