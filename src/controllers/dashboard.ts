import { Request, Response } from 'express';
import prisma from '../prisma';

interface StatsParams {
  usuario_id: string;
}

export const getStats = async (
  req: Request<StatsParams>,
  res: Response
): Promise<void> => {
  const { usuario_id } = req.params;

  try {
    const usuario = await prisma.usuarios.findUnique({
      where: { usuario_id: parseInt(usuario_id) }
    });

    if (!usuario?.colaborador_id) {
      res.status(404).json({ error: "Colaborador não encontrado" });
      return;
    }

    // Ajuste Datas
    const agora = new Date();
    const hojeLocal = new Date(agora.getTime() - (3 * 60 * 60 * 1000));
    const inicioHoje = new Date(hojeLocal);
    inicioHoje.setUTCHours(0, 0, 0, 0);
    const fimHoje = new Date(hojeLocal);
    fimHoje.setUTCHours(23, 59, 59, 999);

    const inicioOntem = new Date(inicioHoje);
    inicioOntem.setUTCDate(inicioHoje.getUTCDate() - 1);
    const fimOntem = new Date(fimHoje);
    fimOntem.setUTCDate(fimHoje.getUTCDate() - 1);
    const seteDiasAtras = new Date(inicioHoje);
    seteDiasAtras.setUTCDate(inicioHoje.getUTCDate() - 6);

    const horasHoje = await prisma.lancamentos_de_horas.aggregate({
      _sum: { duracao_total: true },
      where: {
        colaborador_id: usuario.colaborador_id,
        data_lancamento: { gte: inicioHoje, lte: fimHoje }
      }
    });

    const horasOntem = await prisma.lancamentos_de_horas.aggregate({
      _sum: { duracao_total: true },
      where: {
        colaborador_id: usuario.colaborador_id,
        data_lancamento: { gte: inicioOntem, lte: fimOntem }
      }
    });

    const totalHoje = Number(horasHoje._sum.duracao_total || 0);
    const totalOntem = Number(horasOntem._sum.duracao_total || 0);

    let diferencaPercentual = 0;
    if (totalOntem > 0) {
      diferencaPercentual = ((totalHoje - totalOntem) / totalOntem) * 100;
    } else if (totalHoje > 0) {
      diferencaPercentual = 100;
    }

    const lancamentosSemana = await prisma.lancamentos_de_horas.groupBy({
      by: ['data_lancamento'],
      _sum: { duracao_total: true },
      where: {
        colaborador_id: usuario.colaborador_id,
        data_lancamento: { gte: seteDiasAtras, lte: fimHoje }
      },
      orderBy: { data_lancamento: 'asc' }
    });

    const diasSemanaNomes = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const mapaDeHoras: Record<number, number> = {};

    lancamentosSemana.forEach(item => {
      const dataObj = new Date(item.data_lancamento);
      const diaIndex = dataObj.getUTCDay();
      mapaDeHoras[diaIndex] = Number(item._sum.duracao_total || 0);
    });

    const graficoData = diasSemanaNomes.map((nome, index) => ({
      dia: nome,
      horas: Number((mapaDeHoras[index] || 0).toFixed(1))
    }));

    const META_DIARIA = 8;
    const produtividadeReal = Math.min(Math.round((totalHoje / META_DIARIA) * 100), 100);

    // LÓGICA CARD DE DESPESAS
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

    const despesasMes = await prisma.despesas.aggregate({
      _sum: { valor: true },
      where: {
        data_despesa: { gte: inicioMes, lte: fimHoje }
      }
    });

    const totalDespesas = Number(despesasMes._sum.valor || 0);

    res.json({
      totalHoje: Number(totalHoje.toFixed(1)),
      percentual: Math.round(diferencaPercentual),
      produtividade: produtividadeReal,
      grafico: graficoData,
      totalDespesas: totalDespesas
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao calcular estatísticas" });
  }
};

export default { getStats };
