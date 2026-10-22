# Electromagnetic browser verification

Isolated headless Chrome, localhost:4198. 97 poses per model, physical transforms finite; slider phase continuity passed for motor, speaker and generator; no browser exceptions; 390 px viewport has no horizontal overflow.

```json
[
  {
    "id": "dc-motor",
    "poses": 97,
    "quarterStates": [
      {
        "sample": 0,
        "state": {
          "voltage": 4,
          "omega": 33.057851239669425,
          "current": 1.322314049586777,
          "backEmf": 0.8264462809917357,
          "rpm": 315.6792259673957,
          "phase": 0,
          "polarity": 1,
          "torqueFactor": 1
        }
      },
      {
        "sample": 24,
        "state": {
          "voltage": 4,
          "omega": 33.057851239669425,
          "current": 1.322314049586777,
          "backEmf": 0.8264462809917357,
          "rpm": 315.6792259673957,
          "phase": 1.5707963267948966,
          "polarity": 0,
          "torqueFactor": 0
        }
      },
      {
        "sample": 48,
        "state": {
          "voltage": 4,
          "omega": 33.057851239669425,
          "current": 1.322314049586777,
          "backEmf": 0.8264462809917357,
          "rpm": 315.6792259673957,
          "phase": 3.141592653589793,
          "polarity": -1,
          "torqueFactor": 1
        }
      },
      {
        "sample": 72,
        "state": {
          "voltage": 4,
          "omega": 33.057851239669425,
          "current": 1.322314049586777,
          "backEmf": 0.8264462809917357,
          "rpm": 315.6792259673957,
          "phase": 4.71238898038469,
          "polarity": 0,
          "torqueFactor": 0
        }
      },
      {
        "sample": 96,
        "state": {
          "voltage": 4,
          "omega": 33.057851239669425,
          "current": 1.322314049586777,
          "backEmf": 0.8264462809917357,
          "rpm": 315.6792259673957,
          "phase": 6.283185307179586,
          "polarity": 1,
          "torqueFactor": 1
        }
      }
    ],
    "browserErrors": [],
    "phaseContinuity": true,
    "mobileOverflow": false
  },
  {
    "id": "speaker",
    "poses": 97,
    "quarterStates": [
      {
        "sample": 0,
        "state": {
          "level": 1,
          "frequency": 1,
          "phase": 0,
          "relativeCurrent": 0,
          "excursion": 0,
          "direction": 0
        }
      },
      {
        "sample": 24,
        "state": {
          "level": 1,
          "frequency": 1,
          "phase": 1.5707963267948966,
          "relativeCurrent": 1,
          "excursion": 0.024,
          "direction": 1
        }
      },
      {
        "sample": 48,
        "state": {
          "level": 1,
          "frequency": 1,
          "phase": 3.141592653589793,
          "relativeCurrent": 1.2246467991473532e-16,
          "excursion": 2.9391523179536477e-18,
          "direction": 1
        }
      },
      {
        "sample": 72,
        "state": {
          "level": 1,
          "frequency": 1,
          "phase": 4.71238898038469,
          "relativeCurrent": -1,
          "excursion": -0.024,
          "direction": -1
        }
      },
      {
        "sample": 96,
        "state": {
          "level": 1,
          "frequency": 1,
          "phase": 6.283185307179586,
          "relativeCurrent": -2.4492935982947064e-16,
          "excursion": -5.8783046359072955e-18,
          "direction": -1
        }
      }
    ],
    "browserErrors": [],
    "phaseContinuity": true,
    "mobileOverflow": false
  },
  {
    "id": "relay",
    "poses": 97,
    "quarterStates": [
      {
        "sample": 0,
        "state": {
          "current": 0,
          "pullIn": 0.52,
          "forceRatio": 0,
          "travel": 0,
          "closed": false,
          "ncClosed": true,
          "angle": 0
        }
      },
      {
        "sample": 24,
        "state": {
          "current": 0.3,
          "pullIn": 0.52,
          "forceRatio": 0.33284023668639046,
          "travel": 0.0033233458189557055,
          "closed": false,
          "ncClosed": false,
          "angle": 0.004154194222067498
        }
      },
      {
        "sample": 48,
        "state": {
          "current": 0.6,
          "pullIn": 0.52,
          "forceRatio": 1.3313609467455618,
          "travel": 0.17458369846469546,
          "closed": true,
          "ncClosed": false,
          "angle": 0.22
        }
      },
      {
        "sample": 72,
        "state": {
          "current": 0.8999999999999999,
          "pullIn": 0.52,
          "forceRatio": 2.995562130177514,
          "travel": 0.17458369846469546,
          "closed": true,
          "ncClosed": false,
          "angle": 0.22
        }
      },
      {
        "sample": 96,
        "state": {
          "current": 1.2,
          "pullIn": 0.52,
          "forceRatio": 5.325443786982247,
          "travel": 0.17458369846469546,
          "closed": true,
          "ncClosed": false,
          "angle": 0.22
        }
      }
    ],
    "browserErrors": [],
    "phaseContinuity": false,
    "mobileOverflow": false
  },
  {
    "id": "generator",
    "poses": 97,
    "quarterStates": [
      {
        "sample": 0,
        "state": {
          "rpm": 60,
          "omega": 6.283185307179585,
          "phase": 0,
          "peak": 1.2063715789784804,
          "rms": 0.8530335241264061,
          "emf": -1.2063715789784804,
          "current": -0.12063715789784804,
          "fluxLinkage": 0
        }
      },
      {
        "sample": 24,
        "state": {
          "rpm": 60,
          "omega": 6.283185307179585,
          "phase": 1.5707963267948968,
          "peak": 1.2063715789784804,
          "rms": 0.8530335241264061,
          "emf": 1.9399934600814616e-16,
          "current": 1.9399934600814615e-17,
          "fluxLinkage": 0.192
        }
      },
      {
        "sample": 48,
        "state": {
          "rpm": 60,
          "omega": 6.283185307179585,
          "phase": 3.1415926535897936,
          "peak": 1.2063715789784804,
          "rms": 0.8530335241264061,
          "emf": 1.2063715789784804,
          "current": 0.12063715789784804,
          "fluxLinkage": -6.175190974758285e-17
        }
      },
      {
        "sample": 72,
        "state": {
          "rpm": 60,
          "omega": 6.283185307179585,
          "phase": 4.71238898038469,
          "peak": 1.2063715789784804,
          "rms": 0.8530335241264061,
          "emf": 2.2160686391675015e-16,
          "current": 2.2160686391675014e-17,
          "fluxLinkage": -0.192
        }
      },
      {
        "sample": 96,
        "state": {
          "rpm": 60,
          "omega": 6.283185307179585,
          "phase": 6.283185307179587,
          "peak": 1.2063715789784804,
          "rms": 0.8530335241264061,
          "emf": -1.2063715789784804,
          "current": -0.12063715789784804,
          "fluxLinkage": 1.235038194951657e-16
        }
      }
    ],
    "browserErrors": [],
    "phaseContinuity": true,
    "mobileOverflow": false
  }
]
```
