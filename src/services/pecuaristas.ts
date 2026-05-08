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
  score += volume * 0.5; //multiplica o volume por um fator para aumentar a influência
  score -= distancia * 0.2; //relevancia na distancia tambem influencia, mas menos que o volume

  if (r.POSSUI_CAR === "S") score += 50; //relevancia no possuir car
  if (r.JA_VENDEU === "S") score += 30; //relevancia no fato de já ter vendido

  if (!r.DATA_ULTIMA_VISITA) {
    score += 15; //aumenta pontos para produtores sem visita registrada, indicando potencial inexplorado
  }
  
  return score;
};

export const calculateScoreProspeccao = (r: ApiRancher): number => {
  let score = 0;
  const distancia = Number(r.DISTANCIA_CADASTRADA) || 0;
  if (r.JA_VENDEU === "N") {
    score += 200;          //se ainda não vendeu, tem um potencial maior para prospecção, então aumenta bastante o score
  } else {
    score -= 50;          //pelo contrário, se já vendeu, tem um potencial menor para prospecção, então diminui o score
  }
  score -= distancia * 0.5; //quanto mais distante, menor o score, mas a influência da distância é moderada para não penalizar demais produtores distantes
  if (r.POSSUI_CAR === "S") score += 50; //car é um fator importante para prospecção, então aumenta o score se possuir
  return score;
};

export const calculateScoreLogistica = (r: ApiRancher, filterHab: string): number => {
  let score = 1000; 
  const distancia = Number(r.DISTANCIA_CADASTRADA) || 0;
  const volume = getVolumeBaseadoNoFiltro(r, filterHab);

  score -= distancia * 2; //perde pontos com o aumento da distancia
  score += volume * 0.1;  //ganha pontos com o aumento do volume, mas a influência é menor para não sobrevalorizar produtores com grande volume mas muito distantes
  if (r.POSSUI_CAR === "S") score += 50;  //ganha pontos se possuir CAR

  return score;
};