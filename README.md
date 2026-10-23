Orion Circuit Simulator
Orion is an interactive circuit simulator built with HTML, CSS, and JavaScript. It combines a space-station-themed DC power grid with an experimental electronics workbench to help users explore circuit concepts through adjustable components, calculated measurements, and graphs.
Features
DC power grid
- Switch between series and parallel networks with up to six resistive loads.
- Adjust source voltage, internal resistance, wire resistance, and individual load values.
- Track voltage, current, power, losses, and efficiency as settings change.
- Use a virtual multimeter to measure node-to-node voltage or component current.
- Simulate open circuits, short circuits, and overcurrent breaker trips.
- View worked calculations, animated conventional current or electron flow, and subsystem status indicators.
- Try preset scenarios and mission challenges.
Experimental workbench
Experiment	Available tools
Capacitors and inductors	Add component banks, choose series or parallel connections, and simulate RC charging/discharging or RL current buildup/decay.
Operational amplifiers	Compare inverting and non-inverting configurations, adjust feedback resistors and supply rails, and observe output clipping.
NPN transistors	Adjust base drive, resistances, supply voltage, and current gain to explore cutoff, forward-active operation, and saturation.
Transformers	Change AC input voltage, frequency, turns ratio, and load to compare primary/secondary waveforms, RMS readings, and power.


The workbench displays circuit diagrams, equations, and calculated readings. RC/RL experiments include time constants and stored energy, while device experiments include transfer curves or AC waveforms. Users can add up to six device experiment cards for comparison.
Save and share
- Save / Load: Keep one configuration in the current browser using localStorage.
- Export / Import JSON: Download or reopen configurations, including workbench settings.
- Imported configurations are validated before being applied. Loading opens the station breaker and resets transient playback.
Getting started
No installation, build step, or external JavaScript libraries are required.
1. Save the latest simulator as index.html in the repository root.
2. Open index.html in a modern browser.
3. Choose a circuit topology, adjust the settings, and engage the main breaker.
4. Select Experimental workbench in the top toolbar to explore additional components.
On macOS, from the project directory:
open index.html
For a local web server with Python 3:
python3 -m http.server 8000
Then visit http://localhost:8000. Browser storage can behave differently for directly opened files; use the local server or JSON export when needed.
Implementation
The application is contained in one HTML file:
- HTML defines the controls and page structure.
- CSS provides the responsive layout and visual styling.
- JavaScript manages configurations, circuit calculations, user interactions, and persistence.
- SVG renders circuit diagrams, graphs, and animated flow markers.
Calculation functions are separate from interface rendering. RC/RL transients use analytical exponential responses, and the device cards use simplified electrical models.
Scope
This project is an educational tool. The station supports series and parallel resistive networks; workbench experiments are independent circuits with preset connections. It does not support arbitrary wiring or mixed RLC networks. Op-amps, transistors, and transformers use the assumptions shown in their experiment cards rather than detailed device-specific models.
Author
Royce Cao — University of Georgia
