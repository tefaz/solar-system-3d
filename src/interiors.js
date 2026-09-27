// Layers run from the surface inward. Radii are fractions of the body's radius,
// not volume fractions. Colors and texture are diagrammatic, not photographs.
// The final value is a transition width for regions without a sharp boundary.
const layer=(name,radius,color,description,blend=0)=>({name,radius,color,description,blend});
export const interiors={
  sun:{
    layers:[
      layer('Convection zone',1,'#d5672d','Hot plasma rises, cools, and sinks, carrying energy toward the visible surface.'),
      layer('Radiative zone',.71,'#efa640','Energy travels outward through repeated absorption and emission of light.'),
      layer('Fusion core',.25,'#fff0a6','Hydrogen fuses into helium here, releasing the energy that powers the Sun.'),
    ],
    note:'Plasma throughout, with no solid core. The thin photosphere and atmosphere are omitted.',
    source:'https://science.nasa.gov/sun/facts/',
  },
  mercury:{
    layers:[
      layer('Crust',1,'#786d62','A thin, rocky shell covers Mercury’s surface.'),
      layer('Silicate mantle',.985,'#ba7442','A relatively thin layer of silicate rock surrounds the unusually large core.'),
      layer('Metallic outer core',.85,'#e9ae4e','The partly molten metallic core reaches about 85% of Mercury’s radius.'),
      layer('Solid inner core',.40,'#ffdb83','Gravity and spin measurements suggest a solid inner core; its size remains uncertain.'),
    ],
    note:'Core size is constrained by spacecraft data; the inner-core boundary is approximate.',
    source:'https://science.nasa.gov/mercury/facts/',
  },
  venus:{
    layers:[
      layer('Crust',1,'#97816c','The rocky surface lies beneath a thick atmosphere, omitted in this diagram.'),
      layer('Rocky mantle',.995,'#b96c3c','A thick silicate mantle is inferred from Venus’s size and density.'),
      layer('Iron-rich core',.53,'#eaaa48','An iron-rich core is expected, but its state and internal boundaries are not established.'),
    ],
    note:'An inferred model. Core size and state are uncertain; no separate inner core is assumed.',
    source:'https://science.nasa.gov/venus/venus-facts/',
  },
  earth:{
    layers:[
      layer('Crust',1,'#806c59','The solid outer shell is only about 5–70 km thick; it is very thin at this scale.'),
      layer('Mantle',.995,'#c5773d','Mostly solid silicate rock, slowly flowing over geological time beneath the crust.'),
      layer('Liquid outer core',.546,'#eda449','Moving liquid iron and nickel generate most of Earth’s magnetic field.'),
      layer('Solid inner core',.192,'#ffde83','An iron-rich sphere about 1,221 km in radius, kept solid by immense pressure.'),
    ],
    note:'Boundaries follow seismic estimates. Crust thickness varies; colors are illustrative.',
    source:'https://science.nasa.gov/earth/facts/',
  },
  mars:{
    layers:[
      layer('Crust',1,'#8c5640','A rocky outer shell, with thickness varying across the planet.'),
      layer('Rocky mantle',.985,'#b76438','Silicate rock surrounds the core; deep mantle structure is still being studied.'),
      layer('Liquid outer core',.53,'#eda749','A liquid, iron-rich region containing lighter elements.'),
      layer('Possible inner core',.181,'#ffd384','A 2025 analysis of InSight seismic data suggests a solid inner core about 613 km in radius.'),
    ],
    note:'One seismic model. A solid inner core is suggested by recent research; boundaries remain debated.',
    source:'https://www.nature.com/articles/s41586-025-09361-9',
  },
  jupiter:{
    layers:[
      layer('Molecular hydrogen',1,'#d29c65','A hydrogen and helium envelope becomes denser and more fluid with depth.'),
      layer('Metallic hydrogen',.78,'#ba7746','Under extreme pressure, hydrogen conducts electricity like a metal.',.05),
      layer('Dilute core',.50,'#e7be7d','Heavy elements mix into the surrounding hydrogen, forming a diffuse core rather than a solid ball.',.13),
    ],
    note:'Illustrative model with gradual transitions. Juno data suggest a diffuse core; there is no solid surface.',
    source:'https://science.nasa.gov/jupiter/jupiter-facts/',
  },
  saturn:{
    layers:[
      layer('Molecular hydrogen',1,'#c49b72','A deep hydrogen and helium envelope lies below the visible clouds.'),
      layer('Metallic hydrogen',.70,'#d6904b','Pressure turns hydrogen into an electrically conducting fluid.',.06),
      layer('Diffuse heavy-element core',.55,'#ead29c','Rock and ice constituents mix with hydrogen and helium across an extended core region.',.13),
    ],
    note:'Illustrative diffuse-core model. Boundaries are gradual and uncertain; there is no solid surface.',
    source:'https://arxiv.org/abs/2403.11657',
  },
  uranus:{
    layers:[
      layer('Hydrogen & helium envelope',1,'#8db7b6','A gaseous outer envelope becomes denser toward the interior.'),
      layer('Water-rich fluid interior',.80,'#5c929b','Hot, dense material rich in water, ammonia, and methane—not ordinary frozen ice.',.05),
      layer('Possible rocky core',.22,'#d2b48b','A small rock-rich central region appears in conventional models; its size and structure are uncertain.',.04),
    ],
    note:'A conventional, uncertain model. “Ice” refers to composition, not frozen layers.',
    source:'https://science.nasa.gov/uranus/facts/',
  },
  neptune:{
    layers:[
      layer('Hydrogen & helium envelope',1,'#6293bf','Hydrogen, helium, and methane form the outer envelope beneath the cloud tops.'),
      layer('Water-rich fluid interior',.80,'#49768b','A deep region of hot, dense water, ammonia, and methane under extreme pressure.',.05),
      layer('Possible rocky core',.24,'#c5a37d','A small rock-rich central region is inferred; its exact extent is unknown.',.04),
    ],
    note:'A conventional, uncertain model. Interior composition may mix gradually between regions.',
    source:'https://science.nasa.gov/neptune/neptune-facts/',
  },
  pluto:{
    layers:[
      layer('Water-ice shell',1,'#bdbfc4','A shell of water ice underlies the surface deposits of nitrogen, methane and carbon monoxide ice.'),
      layer('Possible subsurface ocean',.83,'#6f9aaa','Some models suggest liquid water beneath the ice shell; an ocean has not been directly observed.'),
      layer('Rocky core',.70,'#a9876b','A differentiated, rock-rich interior is inferred from Pluto’s density and surface geology.'),
    ],
    note:'A conceptual model. The ocean is hypothetical and layer boundaries are illustrative, not measured.',
    source:'https://science.nasa.gov/dwarf-planets/pluto/facts/',
  },
  moon:{
    layers:[
      layer('Crust',1,'#8e8278','A thin rocky shell preserves the Moon’s ancient impact history.'),
      layer('Mantle',.977,'#bd916b','Silicate rock makes up most of the Moon; a partially molten region may lie at its base.'),
      layer('Liquid outer core',.19,'#dca452','A small fluid iron-rich core extends to roughly 330 km from the center.'),
      layer('Solid inner core',.138,'#eed09a','Seismic models suggest a solid iron-rich center about 240 km in radius.'),
    ],
    note:'Simplified seismic model; the partly molten region above the core is omitted.',
    source:'https://science.nasa.gov/moon/facts/',
  },
};
