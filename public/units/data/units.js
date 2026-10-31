// Unit Tree data
// -------------------------------------------------------------------------
// Every quantity is either:
//   • a SI base unit  (base: true)  — the bottom of every tree, or
//   • built from other quantities through one or more "ways" (formulas).
//
// A way lists its building blocks as  [quantityId, power]:
//   ["force", 1]     → multiply by force
//   ["time", -1]     → divide by time
//   ["velocity", 2]  → multiply by velocity squared
//
// The FIRST way is the main route down to the base units. Extra ways are
// alternative formulas that give the same unit. The page checks that every
// way boils down to the same base units and shows a warning if one doesn't,
// so it's safe to add your own entries as you learn.
//
// Text tricks in `formula`, `sym` and `unit`:  ^2 → superscript,  _k → subscript.
// Single letters in formulas are printed in italics like a textbook.
// -------------------------------------------------------------------------

window.UNIT_DATA = {
  groups: [
    { id: "base", name: "SI base units" },
    { id: "motion", name: "Space & motion" },
    { id: "mechanics", name: "Force & energy" },
    { id: "electric", name: "Electricity & magnetism" },
    { id: "thermal", name: "Heat & chemistry" },
    { id: "light", name: "Light & waves" },
    { id: "radiation", name: "Radiation" },
  ],

  quantities: {
    // ---------------- SI base units ----------------
    length: {
      name: "Length", sym: "l, d, h, r", unit: "m", unitName: "metre", group: "base", base: true,
      note: "Fixed by the speed of light: one metre is how far light travels in a vacuum in 1/299 792 458 of a second.",
    },
    mass: {
      name: "Mass", sym: "m", unit: "kg", unitName: "kilogram", group: "base", base: true,
      note: "Fixed by Planck's constant (h = 6.626 070 15 × 10⁻³⁴ J·s). The only base unit with a prefix (kilo) already in its name.",
    },
    time: {
      name: "Time", sym: "t", unit: "s", unitName: "second", group: "base", base: true,
      note: "Fixed by atoms: one second is 9 192 631 770 cycles of the radiation given off by a caesium-133 atom.",
    },
    current: {
      name: "Electric current", sym: "I", unit: "A", unitName: "ampere", group: "base", base: true,
      note: "Fixed by the charge on one electron. One amp is about 6.24 × 10¹⁸ electrons flowing past a point every second.",
    },
    temperature: {
      name: "Temperature", sym: "T", unit: "K", unitName: "kelvin", group: "base", base: true,
      note: "Fixed by the Boltzmann constant. 0 K is absolute zero, and a 1 K step is the same size as a 1 °C step.",
    },
    amount: {
      name: "Amount of substance", sym: "n", unit: "mol", unitName: "mole", group: "base", base: true,
      note: "A counting unit: one mole is exactly 6.022 140 76 × 10²³ particles (Avogadro's number).",
    },
    luminous: {
      name: "Luminous intensity", sym: "I_v", unit: "cd", unitName: "candela", group: "base", base: true,
      note: "How bright a light looks to the human eye in one direction. A candle flame is roughly 1 cd.",
    },

    // ---------------- Space & motion ----------------
    area: {
      name: "Area", sym: "A", unit: "m^2", group: "motion",
      ways: [
        { formula: "A = l × w", terms: [["length", 1], ["length", 1]],
          note: "Length × width. Metres times metres gives square metres." },
      ],
    },
    volume: {
      name: "Volume", sym: "V", unit: "m^3", group: "motion",
      ways: [
        { formula: "V = A × h", terms: [["area", 1], ["length", 1]],
          note: "Area of the base × height. One litre is 0.001 m³." },
      ],
    },
    velocity: {
      name: "Velocity", sym: "v", unit: "m/s", group: "motion",
      ways: [
        { formula: "v = d / t", terms: [["length", 1], ["time", -1]],
          note: "Distance covered each second. (Speed uses the same unit, just without a direction.)" },
        { formula: "v = f × λ", terms: [["frequency", 1], ["length", 1]],
          note: "Wave speed: waves per second × the length of each wave." },
      ],
    },
    acceleration: {
      name: "Acceleration", sym: "a, g", unit: "m/s^2", group: "motion",
      ways: [
        { formula: "a = Δv / t", terms: [["velocity", 1], ["time", -1]],
          note: "How much the velocity changes each second: metres per second, per second. Gravity gives g ≈ 9.81 m/s²." },
      ],
    },
    frequency: {
      name: "Frequency", sym: "f", unit: "Hz", unitName: "hertz", group: "motion",
      ways: [
        { formula: "f = 1 / T", terms: [["time", -1]],
          note: "Cycles per second (T is the time for one cycle). A count has no unit, so 1 Hz = 1/s." },
      ],
    },
    angle: {
      name: "Angle", sym: "θ", unit: "rad", unitName: "radian", group: "motion",
      ways: [
        { formula: "θ = s / r", terms: [["length", 1], ["length", -1]],
          note: "Arc length ÷ radius. Metres ÷ metres cancel, so the radian has no dimension. A full circle is 2π rad." },
      ],
    },
    solidAngle: {
      name: "Solid angle", sym: "Ω", unit: "sr", unitName: "steradian", group: "motion",
      ways: [
        { formula: "Ω = A / r^2", terms: [["area", 1], ["length", -2]],
          note: "A patch of a sphere's surface ÷ radius². The 3D version of the radian, also dimensionless. A whole sphere is 4π sr." },
      ],
    },
    angularVelocity: {
      name: "Angular velocity", sym: "ω", unit: "rad/s", group: "motion",
      ways: [
        { formula: "ω = θ / t", terms: [["angle", 1], ["time", -1]],
          note: "How fast something spins: radians turned per second." },
      ],
    },

    // ---------------- Force & energy ----------------
    force: {
      name: "Force", sym: "F", unit: "N", unitName: "newton", group: "mechanics",
      ways: [
        { formula: "F = m × a", terms: [["mass", 1], ["acceleration", 1]],
          note: "Newton's second law. 1 N speeds up 1 kg by 1 m/s every second. Weight is the same idea: W = m g." },
        { formula: "F = Δp / t", terms: [["momentum", 1], ["time", -1]],
          note: "Force is how fast momentum changes." },
      ],
    },
    momentum: {
      name: "Momentum", sym: "p", unit: "kg·m/s", group: "mechanics",
      ways: [
        { formula: "p = m × v", terms: [["mass", 1], ["velocity", 1]],
          note: "Mass × velocity: how hard something is to stop." },
        { formula: "p = F × t", terms: [["force", 1], ["time", 1]],
          note: "Impulse: a force applied for some time. So N·s is the same unit as kg·m/s." },
      ],
    },
    energy: {
      name: "Energy / work", sym: "E, W", unit: "J", unitName: "joule", group: "mechanics",
      ways: [
        { formula: "W = F × d", terms: [["force", 1], ["length", 1]],
          note: "Work: push with 1 N for 1 m and you transfer 1 J of energy." },
        { formula: "E_k = ½ m v^2", terms: [["mass", 1], ["velocity", 2]],
          note: "Kinetic energy. The ½ is just a number, so it adds no unit." },
        { formula: "E_p = m g h", terms: [["mass", 1], ["acceleration", 1], ["length", 1]],
          note: "Gravitational potential energy. g is an acceleration (9.81 m/s²)." },
        { formula: "E = P × t", terms: [["power", 1], ["time", 1]],
          note: "Power × time. That's why electricity bills count kilowatt-hours." },
        { formula: "E = Q × V", terms: [["charge", 1], ["voltage", 1]],
          note: "Moving 1 C of charge through 1 V transfers 1 J." },
        { formula: "Q = m c ΔT", terms: [["mass", 1], ["specificHeat", 1], ["temperature", 1]],
          note: "Heat needed to warm a mass m by ΔT." },
      ],
    },
    power: {
      name: "Power", sym: "P", unit: "W", unitName: "watt", group: "mechanics",
      ways: [
        { formula: "P = E / t", terms: [["energy", 1], ["time", -1]],
          note: "Energy per second. A 60 W bulb uses 60 J every second." },
        { formula: "P = F × v", terms: [["force", 1], ["velocity", 1]],
          note: "Pushing with force F while moving at speed v." },
        { formula: "P = V × I", terms: [["voltage", 1], ["current", 1]],
          note: "Electrical power: volts × amps." },
      ],
    },
    pressure: {
      name: "Pressure", sym: "p", unit: "Pa", unitName: "pascal", group: "mechanics",
      ways: [
        { formula: "p = F / A", terms: [["force", 1], ["area", -1]],
          note: "Force spread over an area. 1 Pa is tiny: air pressure at sea level is about 101 000 Pa." },
        { formula: "p = ρ g h", terms: [["density", 1], ["acceleration", 1], ["length", 1]],
          note: "Pressure at depth h in a liquid of density ρ." },
      ],
    },
    density: {
      name: "Density", sym: "ρ", unit: "kg/m^3", group: "mechanics",
      ways: [
        { formula: "ρ = m / V", terms: [["mass", 1], ["volume", -1]],
          note: "Mass packed into each cubic metre. Water is about 1000 kg/m³." },
      ],
    },
    torque: {
      name: "Torque", sym: "τ", unit: "N·m", group: "mechanics",
      ways: [
        { formula: "τ = F × r", terms: [["force", 1], ["length", 1]],
          note: "A turning effect: force × distance from the pivot. Same base units as the joule, but written N·m because it isn't energy." },
      ],
    },

    // ---------------- Electricity & magnetism ----------------
    charge: {
      name: "Electric charge", sym: "Q, q", unit: "C", unitName: "coulomb", group: "electric",
      ways: [
        { formula: "Q = I × t", terms: [["current", 1], ["time", 1]],
          note: "1 A flowing for 1 s moves 1 C, which is about 6.24 × 10¹⁸ electrons." },
      ],
    },
    voltage: {
      name: "Voltage", sym: "V", unit: "V", unitName: "volt", group: "electric",
      ways: [
        { formula: "V = E / Q", terms: [["energy", 1], ["charge", -1]],
          note: "Energy per unit charge: 1 V gives each coulomb 1 J. Also called potential difference." },
        { formula: "V = I × R", terms: [["current", 1], ["resistance", 1]],
          note: "Ohm's law." },
        { formula: "V = P / I", terms: [["power", 1], ["current", -1]],
          note: "Rearranged from P = V × I." },
      ],
    },
    resistance: {
      name: "Resistance", sym: "R", unit: "Ω", unitName: "ohm", group: "electric",
      ways: [
        { formula: "R = V / I", terms: [["voltage", 1], ["current", -1]],
          note: "Volts needed to push each amp of current through." },
      ],
    },
    conductance: {
      name: "Conductance", sym: "G", unit: "S", unitName: "siemens", group: "electric",
      ways: [
        { formula: "G = 1 / R", terms: [["resistance", -1]],
          note: "The flip side of resistance: how easily current flows." },
      ],
    },
    capacitance: {
      name: "Capacitance", sym: "C", unit: "F", unitName: "farad", group: "electric",
      ways: [
        { formula: "C = Q / V", terms: [["charge", 1], ["voltage", -1]],
          note: "Charge stored per volt. 1 F is huge; real capacitors are usually µF or pF." },
      ],
    },
    electricField: {
      name: "Electric field", sym: "E", unit: "N/C", group: "electric",
      ways: [
        { formula: "E = F / q", terms: [["force", 1], ["charge", -1]],
          note: "Force on each coulomb of charge placed in the field." },
        { formula: "E = V / d", terms: [["voltage", 1], ["length", -1]],
          note: "Voltage change per metre, so N/C and V/m are the same unit." },
      ],
    },
    magneticField: {
      name: "Magnetic field", sym: "B", unit: "T", unitName: "tesla", group: "electric",
      ways: [
        { formula: "B = F / (I L)", terms: [["force", 1], ["current", -1], ["length", -1]],
          note: "From F = B I L: 1 T pushes with 1 N on each metre of wire carrying 1 A. Also called magnetic flux density." },
        { formula: "B = F / (q v)", terms: [["force", 1], ["charge", -1], ["velocity", -1]],
          note: "From F = q v B: the force on a moving charge." },
        { formula: "B = Φ / A", terms: [["magneticFlux", 1], ["area", -1]],
          note: "Flux per square metre, so 1 T = 1 Wb/m²." },
      ],
    },
    magneticFlux: {
      name: "Magnetic flux", sym: "Φ", unit: "Wb", unitName: "weber", group: "electric",
      ways: [
        { formula: "Φ = B × A", terms: [["magneticField", 1], ["area", 1]],
          note: "Field strength × the area it passes through." },
        { formula: "Φ = V × t", terms: [["voltage", 1], ["time", 1]],
          note: "From Faraday's law (V = ΔΦ / Δt), so 1 Wb = 1 V·s." },
      ],
    },
    inductance: {
      name: "Inductance", sym: "L", unit: "H", unitName: "henry", group: "electric",
      ways: [
        { formula: "L = Φ / I", terms: [["magneticFlux", 1], ["current", -1]],
          note: "Magnetic flux produced per amp of current." },
        { formula: "L = V Δt / ΔI", terms: [["voltage", 1], ["time", 1], ["current", -1]],
          note: "A current changing by 1 A each second in a 1 H coil induces 1 V." },
      ],
    },

    // ---------------- Heat & chemistry ----------------
    celsius: {
      name: "Celsius temperature", sym: "t", unit: "°C", unitName: "degree Celsius", group: "thermal",
      ways: [
        { formula: "t = T − 273.15", terms: [["temperature", 1]],
          note: "The kelvin scale with its zero moved. A change of 1 °C equals a change of 1 K." },
      ],
    },
    specificHeat: {
      name: "Specific heat capacity", sym: "c", unit: "J/(kg·K)", group: "thermal",
      ways: [
        { formula: "c = Q / (m ΔT)", terms: [["energy", 1], ["mass", -1], ["temperature", -1]],
          note: "Energy to warm 1 kg by 1 K. Water needs about 4200 J/(kg·K)." },
      ],
    },
    molarMass: {
      name: "Molar mass", sym: "M", unit: "kg/mol", group: "thermal",
      ways: [
        { formula: "M = m / n", terms: [["mass", 1], ["amount", -1]],
          note: "Mass of one mole. Usually quoted in g/mol: water is about 18 g/mol." },
      ],
    },
    catalyticActivity: {
      name: "Catalytic activity", sym: "z", unit: "kat", unitName: "katal", group: "thermal",
      ways: [
        { formula: "z = n / t", terms: [["amount", 1], ["time", -1]],
          note: "Moles of reaction a catalyst drives each second (used in biochemistry)." },
      ],
    },

    // ---------------- Light & waves ----------------
    luminousFlux: {
      name: "Luminous flux", sym: "Φ_v", unit: "lm", unitName: "lumen", group: "light",
      ways: [
        { formula: "Φ_v = I_v × Ω", terms: [["luminous", 1], ["solidAngle", 1]],
          note: "Total visible light given off: brightness (cd) × the cone it fills (sr). Light-bulb boxes list lumens." },
      ],
    },
    illuminance: {
      name: "Illuminance", sym: "E_v", unit: "lx", unitName: "lux", group: "light",
      ways: [
        { formula: "E_v = Φ_v / A", terms: [["luminousFlux", 1], ["area", -1]],
          note: "Light landing on each square metre. A bright office is about 500 lx." },
      ],
    },
    intensity: {
      name: "Intensity", sym: "I", unit: "W/m^2", group: "light",
      ways: [
        { formula: "I = P / A", terms: [["power", 1], ["area", -1]],
          note: "Wave power through each square metre. Midday sunlight is roughly 1000 W/m²." },
      ],
    },

    // ---------------- Radiation ----------------
    activity: {
      name: "Radioactivity", sym: "A", unit: "Bq", unitName: "becquerel", group: "radiation",
      ways: [
        { formula: "A = N / t", terms: [["time", -1]],
          note: "Decays per second (N is a count, so it has no unit). Same units as hertz, but named separately so they don't get mixed up." },
      ],
    },
    absorbedDose: {
      name: "Absorbed dose", sym: "D", unit: "Gy", unitName: "gray", group: "radiation",
      ways: [
        { formula: "D = E / m", terms: [["energy", 1], ["mass", -1]],
          note: "Radiation energy absorbed by each kilogram of material." },
      ],
    },
    equivalentDose: {
      name: "Equivalent dose", sym: "H", unit: "Sv", unitName: "sievert", group: "radiation",
      ways: [
        { formula: "H = w_R × D", terms: [["absorbedDose", 1]],
          note: "Absorbed dose × a weighting number for how harmful the radiation type is. Natural background is a few mSv per year." },
      ],
    },
  },
};
