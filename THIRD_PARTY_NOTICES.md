# Third-party notices

The root MIT license covers original project code, teaching text, procedural
model geometry, and screenshots rendered from this project. Third-party code
retains the following copyright notices and licenses, including when bundled
into generated HTML pages.

| Component | Use | License and retained notice |
| --- | --- | --- |
| [Machine skill / kit](https://github.com/AirsupHQ/machine-skill) | `vendor/machine-kit/`, thermal scene rendering helpers | MIT; [Air Supply Technologies Inc. notice](vendor/MACHINE-LICENSE) |
| [Anatomy](https://github.com/wheresryan22/anatomy) | `vendor/anatomy-kit/`, retained historical diagram helpers | MIT; [Ryan notice](vendor/ANATOMY-LICENSE) |
| [Three.js](https://github.com/mrdoob/three.js) 0.170.0 | 3D rendering, controls and environment helpers | MIT; [Three.js authors notice](vendor/THREE-LICENSE) |

Development dependencies are installed through `package-lock.json`, not
vendored here: esbuild uses MIT; Playwright uses Apache-2.0. Their installed
packages retain their upstream notices. Browser binaries and local Python/media
tools are not distributed in this repository or the Pages artifact.

The model images in `assets/home/` and the README overview are rendered from
the project's scenes. Textbook and physics reference links credit external
sources; the linked books, webpages, trademarks and illustrations remain with
their respective owners and are not relicensed by this repository. No textbook
PDFs or copied textbook illustrations are included.

The Pages artifact includes this file, the root license, and all three retained
vendor license files. Preserve them when redistributing the generated pages.
