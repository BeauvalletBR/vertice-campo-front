import { ApiRancher } from "./api"; 


const getVolumeBaseadoNoFiltro = (r: ApiRancher, filterHab: string): number => {
  const china = Number(r.QTD_COMPRADA_12M_CHINA) || 0;
  const naoChina = Number(r.QTD_COMPRADA_12M_NAO_CHINA) || 0;
  
  if (filterHab === "China") return china;
  if (filterHab === "Não China") return naoChina;
  return china + naoChina; 
};

export const calculateScoreVolume = (r: ApiRancher, filterHab: string): number => {
  let score = 0;
  const volume = getVolumeBaseadoNoFiltro(r, filterHab);
  const distancia = Number(r.DISTANCIA_CADASTRADA) || 0;

  score += volume * 0.5; 
  score -= distancia * 0.2;
  
  if (r.POSSUI_CAR === "S") score += 50; 
  if (r.JA_VENDEU === "S") score += 30; 

  if (!r.DATA_ULTIMA_VISITA) {
    score += 15; 
  }

  return score;
};

export const calculateScoreProspeccao = (r: ApiRancher): number => {
  let score = 0;
  const distancia = Number(r.DISTANCIA_CADASTRADA) || 0;

  if (r.JA_VENDEU === "N") {
    score += 200; 
  } else {
    score -= 50; 
  }

  score -= distancia * 0.5;
  if (r.POSSUI_CAR === "S") score += 50; 

  return score;
};

export const calculateScoreLogistica = (r: ApiRancher, filterHab: string): number => {
  let score = 1000; 
  const distancia = Number(r.DISTANCIA_CADASTRADA) || 0;
  const volume = getVolumeBaseadoNoFiltro(r, filterHab);

  score -= distancia * 2; 
  score += volume * 0.1; 
  if (r.POSSUI_CAR === "S") score += 50;

  return score;
};