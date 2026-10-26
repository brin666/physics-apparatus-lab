// Displace whole functional assemblies: coil fins and refrigerant lines stay intact.
// These are spatial teaching layouts, not a physical repair sequence.
export const fridgeAssemblyOwners={filter:'condenser',expansion:'condenser',thermostat:'shell'};
export const acAssemblyOwners={louver:'blower',drain:'blower',reversing:'compressor',expansion:'compressor',accumulator:'compressor'};
export const coolingAssemblyOwners={fridge:fridgeAssemblyOwners,ac:acAssemblyOwners};
export const coolingExploration = {
  fridge: {
    // Keep the cabinet central; stagger complete assemblies around it.
    offsets: {door:[1.34,.17,.10],shell:[0,0,0],condenser:[-1.20,-.10,.30],
      evaporator:[-.98,.72,.24],compressor:[1.15,-.27,.20]},
    tilts:{door:[.04,.18,-.09],shell:[0,0,0],condenser:[.06,.22,-.08],evaporator:[.13,.16,.13],compressor:[.08,-.18,-.12]},
    assemblyOrder:['condenser','compressor','evaporator','shell','door'],
    attachments:fridgeAssemblyOwners,leadIn:.18,
    moveLimit:3.2,focusLift:.025,
  },
  ac: {
    // Two central housings; varied height and tilt keep the surrounding
    // assemblies distinct. The drain tray stays with the indoor blower.
    offsets:{'indoor-shell':[.60,0,0],'outdoor-shell':[-.555,0,0],
      filter:[-.90,.60,.15],'indoor-coil':[-.80,-.08,.14],blower:[1.65,.36,.10],
      'outdoor-coil':[-1.55,.18,.20],fan:[-1.82,-.64,.05],compressor:[.74,-.02,.14]},
    tilts:{'indoor-shell':[0,0,0],'outdoor-shell':[0,0,0],filter:[.10,.20,-.18],
      'indoor-coil':[.04,.22,.12],blower:[.08,-.24,.17],fan:[.08,.22,-.18],'outdoor-coil':[.06,.22,-.12],compressor:[.10,-.22,.16]},
    assemblyOrder:['compressor','outdoor-coil','indoor-coil','fan','blower','filter','outdoor-shell','indoor-shell'],
    attachments:acAssemblyOwners,leadIn:.18,
    moveLimit:3.8,focusLift:.025,
  },
};
