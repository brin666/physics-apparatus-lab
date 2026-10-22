# Indoor AC motion verification

```json
{
  "sweptCylinderToStationaryLowerBoundM": 0.009577736271376293,
  "rotorPhases": 72,
  "louverAngles": 81,
  "actualBladeVertices": 39900,
  "bladeToStationaryLowerBoundM": 0.013675164626838513,
  "nearestStationary": "indoor-fixed-guide-vane",
  "louverToFullRotorEnvelopeM": 0.03844590890881281,
  "fullRotorRadiusM": 0.056013803096286056,
  "panAboveFan": true,
  "drainMonotonicallyFalls": true,
  "bearingAndMotorShaftContinuous": true
}
```

The conservative **entire swept cylinder** also clears all axially overlapping fixed component bounding boxes by at least 9.578 mm. This check covers long triangle edges/interiors that a vertex-only test could miss. The 13.675 mm value is the sampled authored vertex distance, not a claimed exact global surface clearance. The louver check uses all authored blade vertices at 81 angles across -0.26 to -0.06 radians against the full rotor cylinder.

The collector is now between coil and fan: coil bottom y=1.508 m; pan floor y=1.472..1.484 m; rotor envelope top y=1.446014 m. Its x/z footprint contains the fin-pack footprint. Gravity drainage uses a continuously descending path through an actual rear-panel opening, with an aligned hose grommet. Bearing centers, motor center and shaft remain coaxial at y=1.390,z=0.026. The lower vane swings about y=1.318,z=0.125 and its pins reach the side casing.

Only the buildAC indoor block and its local anchors changed; outdoor machine geometry and refrigerant paths were left as owned by the parent. `node build.mjs` completed. Isolated headless Chrome rendered the updated page without errors; overview, close and side images were manually inspected (`physics-ac-indoor-*.png`).
