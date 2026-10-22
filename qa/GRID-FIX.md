# 网格局部矩形变深修复

2026-10-15。用户截图指出曲轴与底座周围的矩形网格对比度与背景不同。

隔离结果：隐藏接触阴影平面没有消除异常；关闭GTAO可消除异常；仅在GTAO法线预通道renderOverride期间将scene.background置空也可消除异常，同时保留模型AO与接触阴影。Three.js的独立背景材质绕过overrideMaterial，原先的HDR网格颜色因此进入了法线缓冲。

修复仅在machine-scene.mjs封装该预通道，使用try/finally恢复背景。没有删除模型平面或关闭整体阴影。

验证：build通过；qa/grid-check.mjs通过（AO与接触阴影保留、模式切换、白板和390px视口、无运行错误）。原异常区域(465,440)-(525,620)与AO关闭参考图的背景像素平均差，从修复前RGB各2.763降为各0。截图见grid-fixed.png、grid-fixed-whiteboard.png和grid-fixed-mobile.png。修复前隔离截图保留为grid-baseline.png等。
