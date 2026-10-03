// Surface inward; each radius is the OUTER radius / body radius, not a mass
// fraction. Diagram choices and observational constraints are documented in
// docs/interior-science.md. Soft transitions describe mixing, not error bars.
export const MAX_INTERIOR_LAYERS=6;
export const interiorMaterials={rock:0,metal:1,fluid:2,envelope:3,plasma:4,ice:5,mixed:6};
const layer=(name,radius,color,description,options={})=>({
  name,radius,color,description,blend:0,material:'rock',phase:'Solid',evidence:'Inferred',extent:'Illustrative boundary',...options,
});
const source=(label,url)=>({label,url});
export const interiors={
  sun:{
    summary:'Helioseismic model',
    layers:[
      layer('Convection zone',1,'#e87835','Buoyant plasma carries energy outward. These are energy-transport regions within the same star, not solid shells.',{material:'plasma',phase:'Plasma',evidence:'Well constrained',extent:'Outer ≈ 29% of the radius'}),
      layer('Radiative zone',.713,'#efb85a','Photons transfer energy through dense plasma. The thin tachocline near its outer edge marks a change in rotation and is not drawn as a separate shell.',{material:'plasma',phase:'Plasma',evidence:'Well constrained',extent:'≈ 25–71% of the radius',blend:.008}),
      layer('Fusion core',.25,'#fff0ae','Most hydrogen fusion occurs in the central quarter of the radius. The center reaches roughly 15 million kelvin; the core is plasma.',{material:'plasma',phase:'Plasma',evidence:'Well constrained',extent:'Central ≈ 25% of the radius',blend:.015}),
    ],
    note:'Transport regions, with no solid core. The photosphere and atmosphere are omitted. Motion and colors are symbolic.',
    sources:[source('NASA · solar interior','https://solarscience.msfc.nasa.gov/interior.shtml')],
  },
  mercury:{
    summary:'Gravity & rotation model',
    layers:[
      layer('Crust',1,'#a59683','A thin silicate crust covers the surface; its thickness varies and is still uncertain.',{extent:'Thin shell; thickness varies'}),
      layer('Silicate mantle',.985,'#967257','Solid silicate rock forms a thin mantle around the exceptionally large metallic core. This crust–mantle boundary is representative.',{extent:'Crust base shown at ≈ 37 km depth'}),
      layer('Metallic outer core',.85,'#f3a74b','At least the outer part of the iron-rich core is liquid. The core extends to roughly 2,074 km from the center.',{material:'fluid',phase:'Liquid',extent:'≈ 85% of the radius'}),
      layer('Possible solid inner core',.40,'#f5d294','Gravity and spin models support a solid center, but do not uniquely determine its size. The shown radius is one plausible choice.',{material:'metal',evidence:'Possible',extent:'Size uncertain; shown at 40%'}),
    ],
    note:'The large core and liquid component are supported by data. The hatched solid center is model dependent; additional core stratification is omitted.',
    sources:[source('NASA · Mercury','https://science.nasa.gov/mercury/facts/'),source('NASA · inner-core constraints','https://pgda.gsfc.nasa.gov/products/73')],
  },
  venus:{
    summary:'Inferred structure',
    layers:[
      layer('Crust',1,'#b29a7c','A thin rocky shell lies beneath the dense atmosphere and clouds, which are omitted from the interior model.',{extent:'Thickness poorly constrained'}),
      layer('Rocky mantle',.995,'#ac7556','A predominantly solid silicate mantle is expected from bulk properties and terrestrial-planet formation. Its detailed structure is not measured.',{extent:'Crust thickness is illustrative'}),
      layer('Iron-rich core',.53,'#d7af73','An iron-rich core is inferred. Its size, liquid fraction, and any solid inner core remain uncertain without seismic measurements.',{material:'metal',phase:'State uncertain',extent:'Size uncertain; shown at 53%'}),
    ],
    note:'A plausible three-region model, not a measured cross-section. No separate inner core is assumed; a magnetic-field absence does not establish core state.',
    sources:[source('NASA · Venus','https://science.nasa.gov/venus/venus-facts/')],
  },
  earth:{
    summary:'Seismically constrained',
    layers:[
      layer('Crust',1,'#ac967a','The solid outer shell is about 5–70 km thick. Its representative thickness is kept small in this diagram.',{evidence:'Well constrained',extent:'5–70 km thick; varies locally'}),
      layer('Mantle',1-32/6371,'#a77558','Mostly solid silicate rock that deforms and convects over geological time. Upper/lower mantle and the 410–660 km mineral transitions are grouped together.',{evidence:'Well constrained',extent:'Crust base to ≈ 2,890 km depth'}),
      layer('Liquid outer core',3480/6371,'#efa349','A liquid iron alloy with nickel and lighter elements. Convection and planetary rotation help sustain Earth’s magnetic dynamo.',{material:'fluid',phase:'Liquid',evidence:'Well constrained',extent:'≈ 3,480 km outer radius'}),
      layer('Solid inner core',1221/6371,'#f6d499','An iron-rich sphere about 1,221 km in radius, kept solid by immense pressure. Its detailed composition and crystal structure remain under study.',{material:'metal',evidence:'Well constrained',extent:'≈ 1,221 km radius'}),
    ],
    note:'Major seismic boundaries are well established. Thin crust and sublayers are simplified; warm colors do not mean the mantle is liquid.',
    sources:[source('USGS · Earth structure','https://pubs.usgs.gov/gip/interior/'),source('USGS · solid mantle','https://www.usgs.gov/faqs/are-tectonic-plates-floating-magma'),source('Core seismology · 2023','https://www.nature.com/articles/s41467-023-41725-5')],
  },
  mars:{
    summary:'Inner-core interpretation',
    layers:[
      layer('Crust',1,'#bb8065','A solid rocky crust varies in thickness. A representative 50 km crust is shown.',{extent:'Representative thickness ≈ 50 km'}),
      layer('Rocky mantle',1-50/3389.5,'#a46950','Predominantly solid silicates surround the core. The alternative basal-melt interpretation adds a separate molten silicate region.',{extent:'Deep boundary is model dependent'}),
      layer('Liquid outer core',.53,'#f2a451','The iron-rich core contains lighter elements and is at least partly liquid. Its inferred outer radius depends on the assumed mantle structure.',{material:'fluid',phase:'Liquid',extent:'Representative radius ≈ 1,800 km'}),
      layer('Possible inner core',613/3389.5,'#f5d097','A 2025 seismic analysis reports a solid inner core of 613 ± 67 km radius. A 2026 review still treats its presence as an open question.',{material:'metal',evidence:'Possible',extent:'Reported radius 613 ± 67 km'}),
    ],
    note:'One proposed interpretation. The inner-core and basal-melt results are not yet reconciled; switch models to see the other interpretation.',
    sources:[source('Inner-core study · 2025','https://www.nature.com/articles/s41586-025-09361-9'),source('InSight review · 2026','https://www.nature.com/articles/s41467-026-72080-w')],
  },
  jupiter:{
    summary:'Juno-informed model',
    layers:[
      layer('Molecular hydrogen',1,'#d6b488','A hydrogen–helium envelope changes continuously from gas to dense fluid with depth. There is no solid surface.',{material:'envelope',phase:'Gas → fluid',extent:'Cloud tops to dense interior'}),
      layer('Metallic hydrogen',.78,'#ce9365','At high pressure, hydrogen becomes an electrically conducting fluid, not a solid metal shell. Helium separation and rain may occur near the transition.',{material:'fluid',phase:'Conducting fluid',extent:'Transition extent is illustrative',blend:.06}),
      layer('Dilute core',.50,'#bda58b','Juno gravity data favor an extended region enriched in heavy elements and mixed with hydrogen and helium. Its extent and any compact central core are model dependent.',{material:'mixed',phase:'Mixed interior',extent:'Diffuse extent is model dependent',blend:.13}),
    ],
    note:'A Juno-informed diffuse core with gradual composition changes. Helium rain and a possible compact central core are not drawn separately.',
    sources:[source('NASA · Juno interior findings','https://science.nasa.gov/jupiter/jupiter-facts/'),source('Juno core models · 2023','https://arxiv.org/abs/2302.09082')],
  },
  saturn:{
    summary:'Gravity & ring-seismology model',
    layers:[
      layer('Molecular hydrogen',1,'#ddc295','A hydrogen–helium envelope becomes denser with depth, without a solid surface.',{material:'envelope',phase:'Gas → fluid',extent:'Cloud tops to dense interior'}),
      layer('Metallic hydrogen',.72,'#c99764','Deep hydrogen is an electrically conducting fluid. Helium separation and rain affect the interior, but are not shown as a distinct shell.',{material:'fluid',phase:'Conducting fluid',extent:'Transition extent is illustrative',blend:.06}),
      layer('Diffuse heavy-element core',.60,'#bdb09a','Cassini gravity and ring seismology support an extended core region reaching roughly 60% of the radius, with a gradual concentration of rock/ice constituents mixed into hydrogen and helium.',{material:'mixed',phase:'Mixed interior',extent:'Extends to roughly 60% of radius',blend:.10}),
    ],
    note:'The core is an extended composition gradient, not a solid rock ball. Transition widths and hydrogen boundaries are schematic.',
    sources:[source('Ring seismology · 2021','https://www.nature.com/articles/s41550-021-01448-3'),source('NASA · Saturn','https://science.nasa.gov/saturn/facts/')],
  },
  uranus:{
    summary:'Composition unresolved',
    layers:[
      layer('Hydrogen & helium envelope',1,'#a3d3cf','An outer hydrogen–helium envelope contains methane. The amount of hydrogen mixed deeper into the planet is uncertain.',{material:'envelope',phase:'Gas → fluid',extent:'Illustrative envelope extent'}),
      layer('Hot mixed interior',.80,'#578f99','Water, other volatiles, rock, and hydrogen may mix under extreme pressure. Both water-rich and rock-rich models fit current constraints; ordinary frozen ice is not implied.',{material:'mixed',phase:'High-pressure mixture',extent:'Composition & boundaries uncertain',blend:.08}),
      layer('Possible rock-rich center',.22,'#c5b297','Some models have a compact rock-rich center; others distribute rock through a broader mixed interior. Its size and physical state are uncertain.',{material:'mixed',phase:'State uncertain',evidence:'Possible',extent:'Illustrative central region',blend:.05}),
    ],
    note:'A conceptual three-region view. Water/rock proportions and liquid, superionic, or solid phases are unresolved; no measured layer radii are implied.',
    sources:[source('Ice-giant review · 2026','https://www.nature.com/articles/s41467-026-72079-3'),source('Water/rock models · 2025','https://arxiv.org/abs/2510.00175')],
  },
  neptune:{
    summary:'Composition unresolved',
    layers:[
      layer('Hydrogen & helium envelope',1,'#86b7c9','Hydrogen, helium, and methane form the outer envelope; its depth and mixing with heavier constituents are uncertain.',{material:'envelope',phase:'Gas → fluid',extent:'Illustrative envelope extent'}),
      layer('Hot mixed interior',.80,'#577d98','High-pressure mixtures of volatiles, rock, and hydrogen may fill much of the interior. Current measurements do not uniquely favor a water-rich composition.',{material:'mixed',phase:'High-pressure mixture',extent:'Composition & boundaries uncertain',blend:.08}),
      layer('Possible rock-rich center',.24,'#bbaa94','A compact rock-rich center is one model choice, rather than a directly detected solid core. Rock may instead be mixed over a larger region.',{material:'mixed',phase:'State uncertain',evidence:'Possible',extent:'Illustrative central region',blend:.05}),
    ],
    note:'A conceptual three-region view. Its structure need not match Uranus’s; the similar diagrams do not establish identical interiors.',
    sources:[source('Ice-giant review · 2026','https://www.nature.com/articles/s41467-026-72079-3'),source('Water/rock models · 2025','https://arxiv.org/abs/2510.00175')],
  },
  pluto:{
    summary:'Conceptual ocean scenario',
    layers:[
      layer('Water-ice shell',1,'#c4d9de','Solid water ice lies below thin surface deposits of nitrogen, methane, and carbon monoxide ice, omitted at this scale.',{material:'ice',extent:'Thickness is model dependent'}),
      layer('Possible subsurface ocean',.83,'#56899c','Geology and thermal models allow liquid water below the ice shell. It has not been directly observed, and oceanless models also exist.',{material:'fluid',phase:'Liquid if present',evidence:'Possible',extent:'Ocean size is illustrative'}),
      layer('Rocky core',.70,'#a3947e','A differentiated rock-rich center is inferred from density and geological modeling. Its displayed size is a conceptual choice.',{extent:'Illustrative core radius'}),
    ],
    note:'An ocean-bearing scenario, not a confirmed ocean. Hatching marks the hypothetical water layer; the radii are not measured.',
    sources:[source('NASA · Pluto','https://science.nasa.gov/dwarf-planets/pluto/facts/'),source('Ocean formation model · 2020','https://www.nature.com/articles/s41561-020-0595-0'),source('Oceanless impact model · 2024','https://www.nature.com/articles/s41550-024-02248-1')],
  },
  moon:{
    summary:'Seismic & tidal model',
    layers:[
      layer('Crust',1,'#b0a699','A solid silicate crust is thinner on the near side than the far side. A representative 40 km shell is shown.',{extent:'≈ 40–60 km thick; varies locally'}),
      layer('Mantle',1-40/1737.4,'#a38265','Mostly solid silicate rock dominates the Moon. The deep mantle is less well resolved than the shallow structure.',{extent:'Largest region by volume'}),
      layer('Possible partial-melt zone',500/1737.4,'#c18b65','A low-viscosity region around the core may contain partial melt, rather than being an entirely liquid magma ocean. Its thickness and melt fraction are debated.',{material:'mixed',phase:'Possible partial melt',evidence:'Possible',extent:'Illustrative outer radius ≈ 500 km',blend:.012}),
      layer('Liquid outer core',330/1737.4,'#e7a865','A small iron-rich fluid core is supported by seismic and rotational constraints. Around 330 km is a representative outer radius, not a unique value.',{material:'fluid',phase:'Liquid',extent:'Representative radius ≈ 330 km'}),
      layer('Solid inner core',258/1737.4,'#eed1a2','A 2023 geophysical study favors a solid iron-rich center of 258 ± 40 km radius, consistent with earlier estimates near 240 km.',{material:'metal',extent:'Model estimate 258 ± 40 km'}),
    ],
    note:'The deep radii are model dependent. The partly molten basal mantle is shown separately from the liquid metallic core.',
    sources:[source('NASA · lunar composition','https://science.nasa.gov/moon/composition/'),source('Inner-core study · 2023','https://www.nature.com/articles/s41586-023-05935-7'),source('Partial-melt debate · 2023','https://doi.org/10.1029/2022JE007652')],
  },
};
const marsBasalMelt={
  summary:'Basal-melt interpretation',
  layers:[
    interiors.mars.layers[0],interiors.mars.layers[1],
    layer('Possible molten silicate layer',1800/3389.5,'#ce8556','2023 seismic interpretations place molten silicates above a smaller metal core. The shown ≈ 150 km layer is illustrative; its compatibility with a solid inner core remains unsettled.',{material:'fluid',phase:'Molten rock if present',evidence:'Possible',extent:'Illustrative outer radius ≈ 1,800 km'}),
    layer('Liquid iron-rich core',1650/3389.5,'#efae65','The basal-melt interpretation gives a denser liquid metal core with a radius around 1,650 ± 20 km. This scenario does not assume a separate solid inner core.',{material:'fluid',phase:'Liquid',extent:'Model estimate 1,650 ± 20 km'}),
  ],
  note:'A separate interpretation of InSight data, not an extra layer added to the inner-core model. Neither scenario uniquely establishes Mars’s deep structure.',
  sources:[source('Basal-melt study · 2023','https://www.nature.com/articles/s41586-023-06601-8'),source('InSight review · 2026','https://www.nature.com/articles/s41467-026-72080-w')],
};
export const getInterior=(id,variant='inner-core')=>id==='mars'&&variant==='basal-melt'?marsBasalMelt:interiors[id];
