import React from 'react';

export interface RegiaoGoias {
  id: string;
  name: string;
}

interface MapaGoiasProps {
  activeRegion: string | null;
  onRegionClick: (regionId: string) => void;
}

export function MapaGoias({ activeRegion, onRegionClick }: MapaGoiasProps) {
  // Lógica de CSS para o efeito 3D (Relevo)
  const getPathClass = (regionId: string) => {
    const isSelected = activeRegion === regionId;
    const isFaded = activeRegion !== null && activeRegion !== regionId;
    
    return `
      transition-all duration-300 cursor-pointer origin-center
      ${isSelected ? 'fill-primary stroke-white stroke-[3px] drop-shadow-[0_10px_10px_rgba(0,0,0,0.3)] z-10 -translate-y-2' : 'fill-slate-300 stroke-white stroke-[1px]'}
      ${isFaded ? 'opacity-40' : 'hover:fill-primary/70 hover:-translate-y-1 hover:drop-shadow-md'}
    `;
  };

  return (
    <div className="w-full max-w-md mx-auto aspect-square relative">
      {/* Mapa Esquemático de Goiás (Vetorizado em Blocos) */}
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
        
        {/* NORTE */}
        <polygon 
          id="norte" onClick={() => onRegionClick("norte")} className={getPathClass("norte")}
          points="40,5 60,5 65,25 35,25" 
        />
        <text x="50" y="17" className="text-[3px] font-bold fill-white pointer-events-none text-anchor-middle">NORTE</text>

        {/* NORDESTE */}
        <polygon 
          id="nordeste" onClick={() => onRegionClick("nordeste")} className={getPathClass("nordeste")}
          points="65,25 85,25 90,45 70,45" 
        />
        <text x="77" y="36" className="text-[3px] font-bold fill-white pointer-events-none text-anchor-middle">NORDESTE</text>

        {/* NOROESTE */}
        <polygon 
          id="noroeste" onClick={() => onRegionClick("noroeste")} className={getPathClass("noroeste")}
          points="15,25 35,25 40,45 20,45" 
        />
        <text x="27" y="36" className="text-[3px] font-bold fill-white pointer-events-none text-anchor-middle">NOROESTE</text>

        {/* CENTRO (RCG) */}
        <polygon 
          id="rcg" onClick={() => onRegionClick("rcg")} className={getPathClass("rcg")}
          points="40,45 70,45 65,60 45,60" 
        />
        <text x="55" y="54" className="text-[3px] font-bold fill-white pointer-events-none text-anchor-middle">CENTRO</text>

        {/* ENTORNO (DF) */}
        <polygon 
          id="entorno" onClick={() => onRegionClick("entorno")} className={getPathClass("entorno")}
          points="70,45 90,45 85,60 65,60" 
        />
        <text x="77" y="54" className="text-[3px] font-bold fill-white pointer-events-none text-anchor-middle">ENTORNO</text>

        {/* RMG (Goiânia) */}
        <polygon 
          id="rmg" onClick={() => onRegionClick("rmg")} className={getPathClass("rmg")}
          points="45,60 65,60 60,70 50,70" 
        />
        <text x="55" y="66" className="text-[2px] font-bold fill-white pointer-events-none text-anchor-middle">RMG</text>

        {/* OESTE */}
        <polygon 
          id="oeste" onClick={() => onRegionClick("oeste")} className={getPathClass("oeste")}
          points="10,45 40,45 45,60 15,60" 
        />
        <text x="27" y="54" className="text-[3px] font-bold fill-white pointer-events-none text-anchor-middle">OESTE</text>

        {/* SUDOESTE */}
        <polygon 
          id="sudoeste" onClick={() => onRegionClick("sudoeste")} className={getPathClass("sudoeste")}
          points="15,60 50,70 45,95 20,85" 
        />
        <text x="32" y="75" className="text-[3px] font-bold fill-white pointer-events-none text-anchor-middle">SUDOESTE</text>

        {/* SUL */}
        <polygon 
          id="sul" onClick={() => onRegionClick("sul")} className={getPathClass("sul")}
          points="50,70 60,70 65,95 45,95" 
        />
        <text x="55" y="85" className="text-[3px] font-bold fill-white pointer-events-none text-anchor-middle">SUL</text>

        {/* SUDESTE */}
        <polygon 
          id="sudeste" onClick={() => onRegionClick("sudeste")} className={getPathClass("sudeste")}
          points="60,70 85,60 95,80 65,95" 
        />
        <text x="75" y="75" className="text-[3px] font-bold fill-white pointer-events-none text-anchor-middle">SUDESTE</text>

      </svg>
    </div>
  );
}