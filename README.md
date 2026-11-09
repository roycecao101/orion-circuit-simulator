# Orion Circuit Simulator

An interactive teaching lab in plain HTML, CSS, and native JavaScript ES modules. No framework, backend, build step, or runtime dependencies.

## Run locally

From this directory, run:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000>. Serve the files over HTTP; opening `index.html` directly with `file://` will not reliably load ES modules. Stop the server with Ctrl+C.

## Features

- Series/parallel resistive networks with up to six loads, open/short faults, breaker protection, an ideal virtual multimeter, animated current/electron flow, telemetry, and worked calculations.
- Station presets and mission challenges.
- Capacitor and inductor banks (up to six each), series/parallel connections, analytical RC/RL charging and decay, source switching, stepping, and playback through 5τ.
- Up to six independent workbench cards for rail-limited op-amps, piecewise NPN transistors, and ideal AC transformers, including schematics and plots.
- Browser Save/Load and JSON import/export, including existing version 2 configurations. Older version 2 saves without energy-lab or workbench settings receive the original defaults. Loading opens the main breaker and resets transient playback; playback position is not persisted. The storage key remains `orion-circuit-v2`.
- Responsive layouts and scrollable SVG schematics on narrow screens; reduced-motion preferences suppress flow animation.

Browser storage is scoped to the origin (including the server port). To transfer an existing save from another origin, export JSON there and import it here. Imports retain the existing 100 KB file limit and configuration validation.

## File responsibilities

| File | Responsibility |
| --- | --- |
| `index.html` | Page structure, stylesheet link, and module entry point |
| `css/styles.css` | Original styles and responsive breakpoints |
| `js/app.js` | Sole owner of mutable configuration, breaker and transient runtime state; initialization, events, UI updates, presets, challenges, and persistence |
| `js/components.js` | Component definitions, original defaults/limits, experiment creation, and configuration validation |
| `js/circuit.js` | Equivalent resistance/capacitance/inductance, RC/RL circuit parameters, and multimeter node potentials |
| `js/simulator.js` | Pure DC, RC/RL, op-amp, transistor, and transformer calculations |
| `js/canvas.js` | SVG diagrams, plots, formatting, and flow animation; owns rendering caches and receives live state through an explicit renderer context |
| `tests/engine.test.js` | Calculation invariants, edge cases, save compatibility, and invalid configurations |
| `tests/ui-smoke.test.js` | Lightweight DOM harness for initialization, control handlers, rendering/animation wiring, and persistence |

Modules use explicit imports/exports with no circular dependencies. Calculation and validation modules have no DOM dependencies and can be imported directly in Node. Storage component input values are µF and mH; equivalent values and calculation outputs use SI units. RC/RL response time `q` is elapsed time divided by τ.

## Tests

Install Node.js 18 or newer (including npm). No packages need to be installed:

```sh
npm test
# or
node --test
```

Tests cover equivalent values, power balance, meter nodes, faults and ideal shorts, RC/RL step responses and switching continuity, clipping, all transistor operating regions, transformer ratios, and invalid imports. The DOM harness exercises application wiring without a browser; it does not verify visual layout, native file dialogs, browser storage permissions, or real browser console output.

For browser verification, serve the app and check the console while changing topology, engaging/tripping/resetting the breaker, editing loads and faults, using meter probes, applying presets, and checking challenges. Check flow pause/direction, RC/RL run/step/switch/reset, each device card, Save/Load, and JSON export/import. Inspect desktop and narrow layouts, including sideways scrolling within diagrams.

## Model limits

The original teaching assumptions and limits are retained. Storage experiments and device cards operate independently of the station circuit. RC/RL experiments test one bank at a time, with ideal uncoupled inductors, zero initial energy, and total resistance including source and wire resistance. There is no mixed RLC solver. Op-amps have ideal feedback and rail clipping without bandwidth or current limits. NPN transistors use fixed 0.7 V base-emitter and 0.2 V saturation drops. Transformers are ideal sinusoidal AC models with conserved RMS power and no core or winding losses. Undefined ideal-short quantities remain represented as infinity or NaN and displayed using the original conventions.
