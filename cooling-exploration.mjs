// Displace whole functional assemblies: coil fins and refrigerant lines stay intact.
// These are spatial teaching layouts, not a physical repair sequence.
export const fridgeAssemblyOwners={filter:'condenser',expansion:'condenser',thermostat:'shell'};
export const acAssemblyOwners={louver:'blower',drain:'blower',reversing:'compressor',expansion:'compressor',accumulator:'compressor'};
export const coolingAssemblyOwners={fridge:fridgeAssemblyOwners,ac:acAssemblyOwners};
export const coolingExploration = {
  fridge: {
    // Keep the cabinet as the central reference. Exchanger and compressor
    // locations form separate screen-space slots in the default teaching view.
    offsets: {door:[1.30,.08,.08],shell:[0,0,0],condenser:[-1.10,-.02,.35],
      evaporator:[-1.10,.57,.20],compressor:[1.15,-.20,.15]},
    tilts:{door:[0,.12,0],shell:[0,0,0],condenser:[0,.16,0],evaporator:[.10,.16,0]},
    assemblyOrder:['condenser','compressor','evaporator','shell','door'],
    attachments:fridgeAssemblyOwners,leadIn:.18,
    moveLimit:3.2,focusLift:.025,
  },
  ac: {
    // Two central housings, with complete airflow and refrigeration assemblies
    // in separate side columns. The drain tray stays with the indoor blower.
    offsets:{'indoor-shell':[.60,0,0],'outdoor-shell':[-.555,0,0],
      filter:[-.60,.37,.10],'indoor-coil':[-.60,.04,.14],blower:[1.80,.02,.04],
      'outdoor-coil':[-1.646,.17,.20],fan:[-1.61,-.50,-.05],compressor:[.388,.04,.02]},
    tilts:{'indoor-shell':[0,0,0],'outdoor-shell':[0,0,0],filter:[.08,.12,0],
      'indoor-coil':[0,.12,0],fan:[0,.12,0],'outdoor-coil':[0,.12,0]},
    assemblyOrder:['compressor','outdoor-coil','indoor-coil','fan','blower','filter','outdoor-shell','indoor-shell'],
    attachments:acAssemblyOwners,leadIn:.18,
    moveLimit:3.8,focusLift:.025,
  },
};
