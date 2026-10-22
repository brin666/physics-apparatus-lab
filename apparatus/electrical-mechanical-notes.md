# Electromagnetic and mechanical teaching models

These are authored teaching geometries, not replicas of a particular product. Dimensions used to build the meshes are illustrative. The numerical models only show quantities supported by the stated assumptions; qualitative electromagnetic effects stay qualitative.

## Induction hob

The visible path is power board → flat copper work coil → changing magnetic field across the ceramic-glass panel → closed eddy-current loops in the bottom of a suitable ferromagnetic pan. Resistance in the pan bottom converts electrical energy to internal energy, and the pan transfers heat to food. The model opens the pan vessel and uses x-ray as its default final view so the teaching overlays and coil can be inspected; the orange paths are drawn on the visible floor for legibility, but represent current in the bottom sheet rather than a measured current direction or magnitude. The blue lines are not a field-strength map. No cookware temperature, coil amperage, or wattage is invented. The control is a normalized drive setting and the readout reports only qualitative presence and strength.

The U.S. Department of Energy describes induction as an electromagnetic field transferring current directly to cookware and heat being created in the cookware itself: [Making the Switch to Induction Stoves or Cooktops](https://www.energy.gov/articles/making-switch-induction-stoves-or-cooktops). The Department of Energy EERE appliance roadmap describes the high-frequency inverter, flat spiral winding under the glass-ceramic panel, and eddy currents induced in the vessel bottom: [Research & Development Roadmap for Next-Generation Appliances](https://www1.eere.energy.gov/buildings/pdfs/next_generation_appliances_roadmap.pdf). These references support the qualitative path and do not set this model's scale or control values.

## Metal-foil electroscope

`near` begins with a neutral electroscope and a charged rod brought close without contact. The conductor polarizes: charge of the rod's sign appears on the leaves while opposite charge gathers near the terminal; the total electroscope charge stays zero. `move-away` describes that same neutral starting condition after a rod that only approached is removed, so the leaves collapse. `contact` transfers charge, leaving the electroscope with the rod's sign. Induction charging is shown in separate snapshots: `grounded` keeps the charged rod near while the earth wire is connected; `isolated` breaks the ground connection while the rod is still near; `induction-done` then removes the rod. The final electroscope net charge is opposite to the rod, with no contact between rod and terminal. The base trim ring lies flat on the circular insulator base; its orientation is structural decoration and does not depict a conductor path.

OpenStax College Physics explains contact transfer, polarization without net charge, and the grounding sequence in which the ground connection is broken before the charged object is removed: [18.2 Conductors and Insulators](https://openstax.org/books/college-physics/pages/18-2-conductors-and-insulators). The colored dots indicate the direction of charge distribution, not a particle count. Leaf angle is exaggerated and is not a charge or force measurement.

## Sliding rheostat

The model includes four terminals: A and B connect to the two ends of the resistance winding; C and D connect to the same metal slider rail. The illustrated series circuit connects the load to one winding end (A or B) and the slider node (C). Moving the slider changes the length of the resistance wire between that selected winding end and the contact. Choosing the other winding end reverses which direction increases resistance. The unselected lower winding terminal is open in the example circuit; C and D are electrically duplicate slider terminals.

The model's helix length follows its authored geometry:

```text
Ltotal = N × √((2πr)² + (ℓ/N)²)
Lconnected = f × Ltotal
Rrheostat = 12 Ω × Lconnected/Ltotal
I = V/(Rload + Rrheostat)
```

For 36 turns, helix radius 0.095 m, and axial span 0.78 m, the displayed path is approximately 21.50 m. This is a dimension of the teaching mesh, not a measurement of classroom hardware. The 12 Ω full-range rheostat, 6 Ω series load, 6 V default source, and zero contact/lead resistance are illustrative circuit assumptions. `position` is a unit fraction from the left end of the modeled winding; the A/B selector defines the connected end. `voltage` sets the source voltage.

OpenStax covers resistance and Ohm's law in simple circuits: [20.2 Ohm's Law: Resistance and Simple Circuits](https://openstax.org/books/college-physics-2e/pages/20-2-ohms-law-resistance-and-simple-circuits). Its University Physics text gives series-resistance addition and current from source voltage divided by total series resistance: [10.2 Resistors in Series and Parallel](https://openstax.org/books/university-physics-volume-2/pages/10-2-resistors-in-series-and-parallel). Those relationships support the current calculation; the selected wire-length fraction and 12 Ω calibration are model choices.

For the four-post classroom layout, the East China Normal University journal *Physics Teaching* describes connecting the winding endpoints A/B and the metal-rod endpoints C/D, and has students trace current through the chosen winding segment: [Physics Teaching, 2022](https://wljx.ecnu.edu.cn/assets/userfiles/PDF/127039_20220516184053.pdf). The People's Education Press curriculum page also lists an investigation of how the resistance of an even alloy wire changes with its connected length: [4.1 Resistance Law teaching design](https://www.pep.com.cn/zzggjc/wl2023/tyl/jxsj/202302/t20230222_1982320.shtml).

## Two-pulley block and tackle

One continuous rope is anchored to the top beam, descends around the moving sheave, rises over the fixed sheave, then exits at the free end. Two rope segments support the moving block and load. With ideal massless, inextensible rope and frictionless, massless pulleys:

```text
W = mg
Fpull = W/2
Δhload = Δxpull/2
```

The gravity constant is 9.81 m/s². The mass and pull distance are demonstration inputs. The readout does not claim real pulley efficiency, friction loss, elastic stretch, sheave inertia, or acceleration. The rope's rendered spline is a schematic route, while its motion and readout follow the ideal two-supporting-strand relation.

OpenStax College Physics states that the ideal mechanical advantage of a pulley combination is approximately the number of rope segments directly pulling upward on the load, and illustrates the two-strand arrangement: [9.5 Simple Machines](https://openstax.org/books/college-physics/pages/9-5-simple-machines). OpenStax Physics gives the distance trade-off for simple machines and the pulley ideal mechanical advantage: [9.3 Simple Machines](https://openstax.org/books/physics/pages/9-3-simple-machines).

## 2026-10-21 physical structure correction (supersedes earlier geometry notes)

Confirmed defects and fixes:

- Pulley: the old middle span ran diagonally between nonmatching tangency points, so the visible rope length changed despite an exact 2:1 numerical readout. It is now an analytic curve: three vertical spans plus two tangent semicircles, with sheave centers at x=0 and x=0.24 m and rope-center radius 0.12 m. The lower center moves from y=0.60 to 0.90; the free end moves from y=0.95 to 0.35. The rope radius is 0.009 and the groove core radius is 0.111. Both wrap arcs therefore contact the groove and clear its solid core. The bearing fork is in front/behind the rope plane; the load suspension is centered beneath the moving axle. The new render removes loose decorative braces. Rotations use no-slip signs for a stationary anchored strand and a downward-moving free end.
- Electroscope: the rod formerly missed the terminal vertically; it now contacts the actual sphere surface. Foil tops now reach their common hinge, and the conductor stops at the hinge instead of running through the hanging leaves. The lid has an opening around the insulating plug. Grounding/isolating while the rod remains nearby leaves charge concentrated near the terminal and the leaves approximately closed. Removing the rod redistributes the same charge and opens the leaves. Explicit `contact-away` retains same-sign charge; explicit `discharge` connects earth with the rod far away. Relative charge units balance body + two leaves, and transfers to rod/earth balance the net scope charge. These units are a bookkeeping model, not electron counts or electrostatic field solutions.
- Rheostat: the original brush floated off the winding, some winding-end leads did not touch the actual helix, the ceramic core intersected the wire, and B-end highlighting selected the wrong interval. The winding now begins/ends at actual top contacts, the core clears its wire, the slider shoe touches a real turn, and A/B lead paths start at those exact endpoints. The slider snaps to one of 37 top contacts for the 36-turn coil; the displayed resistance/current uses that same actual contact position. The active overlay follows the helix itself, with the B interval extending from the contact to the right end. The load's binding posts have conducting stems down to the resistor.
- Induction hob: the rim used to be vertical, the housing was a solid block through the electronics, and the blue loops floated beside the pan. The pan now has a horizontal rim and rests on the glass; its open sidewall joins its bottom. The chassis is a floor plus perimeter walls, with electronics behind the heating coil. Ferrite supports a thin insulating coil carrier. Coil leads terminate at the real spiral ends. Eddy loops lie in the pan-bottom plane, and closed field loops pass through the bottom then return outside the coil in radial vertical planes. No-pan operation disables drive/field/eddy display, following the common pan-detection behavior described by DOE. Field strength, phase lag, temperature, and eddy-current magnitude are not numerically solved.

A browser-only defect was also found: shared `appearance()` reset root visibility each frame, undoing model visibility for the earth lead and removed pan. The module now publishes `userData.modelVisible`; the parent agent owns the shared renderer fix that respects it. Browser assertions check the actual rendered root visibility after animation frames, beyond the pure model tests.

Evidence:

- `node --test apparatus/electrical-mechanical.test.mjs`: 10 tests, including 61 rope positions and 74 A/B contact cases, exact length/tangent/hub-clearance checks, charge conservation, actual brush/helix endpoint checks, and field-loop crossings.
- `node qa/physics-mechanical-browser.mjs`: isolated headless Chrome at localhost:4198; 15 representative operation/range states, no browser errors, and final visibility assertions. Images are `qa/physics-mechanical-*.png`.
- Primary reference for electroscope sequence: [University of Colorado Physics Undergraduate Labs, Induced Charge on Electroscope](https://physicslabs.colorado.edu/demos/electricity-and-magnetism/electrostatics/induced-charge/induced-charge-on-electroscope/), checked 2026-10-21. Its photographed sequence explicitly removes ground first, then the rod, and retains opposite-polarity charge.
- Other checked primary textbook/agency references: [OpenStax 18.2](https://openstax.org/books/college-physics/pages/18-2-conductors-and-insulators), [OpenStax 9.5](https://openstax.org/books/college-physics/pages/9-5-simple-machines), [DOE induction cooktops](https://www.energy.gov/articles/making-switch-induction-stoves-or-cooktops).

Bounds: these are structural teaching models with idealized force/charge/circuit responses. They are not finite-element electrostatic/magnetic solutions, manufacturing drawings, thermal transients, or a fully user-wired circuit. Operation dropdown values represent named experiment snapshots; the guided sequence explicitly performs grounding between charge experiments.
